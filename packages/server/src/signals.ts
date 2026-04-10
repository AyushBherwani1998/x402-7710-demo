import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";

const transport = new HttpTransport();
const info = new InfoClient({ transport });

const SUPPORTED_TOKENS = ["ETH", "BTC", "SOL", "ZRO", "ZEC"] as const;
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

export function isSupportedToken(token: string): token is SupportedToken {
  return SUPPORTED_TOKENS.includes(token as SupportedToken);
}

export { SUPPORTED_TOKENS };

// ─── Indicator calculations ─────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    ema.push((values[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  return ema;
}

function computeMACD(closes: number[]): {
  line: number;
  signal: number;
  histogram: number;
} {
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);

  if (ema12.length === 0 || ema26.length === 0) {
    return { line: 0, signal: 0, histogram: 0 };
  }

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }

  const signalLine = computeEMA(macdLine, 9);
  const lastIdx = closes.length - 1;
  const line = macdLine[lastIdx];
  const signal = signalLine[lastIdx];

  return {
    line: round(line),
    signal: round(signal),
    histogram: round(line - signal),
  };
}

function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  if (closes.length < 2) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) {
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ─── Signal generation ──────────────────────────────────────────────────────

export async function generateTradingSignal(coin: SupportedToken) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Fetch current price and 4h candles in parallel
  const [mids, candles] = await Promise.all([
    info.allMids(),
    info.candleSnapshot({
      coin,
      interval: "4h",
      startTime: thirtyDaysAgo,
      endTime: now,
    }),
  ]);

  const currentPrice = parseFloat(mids[coin]);
  if (!currentPrice || isNaN(currentPrice)) {
    throw new Error(`No price data available for ${coin}`);
  }

  if (candles.length < 30) {
    throw new Error(`Insufficient candle data for ${coin} (got ${candles.length})`);
  }

  const closes = candles.map((c) => parseFloat(c.c));
  const highs = candles.map((c) => parseFloat(c.h));
  const lows = candles.map((c) => parseFloat(c.l));
  const volumes = candles.map((c) => parseFloat(c.v));

  // Compute indicators
  const rsi = round(computeRSI(closes));
  const macd = computeMACD(closes);
  const ema20Values = computeEMA(closes, 20);
  const ema50Values = computeEMA(closes, 50);
  const ema20 = round(ema20Values[ema20Values.length - 1]);
  const ema50 = round(ema50Values[ema50Values.length - 1]);
  const atr = computeATR(highs, lows, closes);

  // Volume analysis: compare recent avg volume to overall avg
  const recentVolumes = volumes.slice(-6); // last 24h of 4h candles
  const olderVolumes = volumes.slice(-30, -6);
  const recentAvgVol =
    recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const olderAvgVol =
    olderVolumes.length > 0
      ? olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length
      : recentAvgVol;
  const volumeChange =
    olderAvgVol > 0
      ? round(((recentAvgVol - olderAvgVol) / olderAvgVol) * 100)
      : 0;

  // Signal logic based on indicator confluence
  const bullishSignals = [
    rsi > 50 && rsi < 70,
    macd.histogram > 0,
    ema20 > ema50,
    currentPrice > ema20,
    volumeChange > 0,
  ];
  const bullishCount = bullishSignals.filter(Boolean).length;
  const signal = bullishCount >= 3 ? "LONG" : "SHORT";
  const conviction =
    bullishCount >= 4 ? "HIGH" : bullishCount >= 3 ? "MEDIUM" : "LOW";

  // SL/TP based on ATR
  const stopLoss =
    signal === "LONG" ? currentPrice - atr * 1.5 : currentPrice + atr * 1.5;
  const takeProfit =
    signal === "LONG" ? currentPrice + atr * 2.5 : currentPrice - atr * 2.5;

  const riskRewardRatio = round(
    Math.abs(takeProfit - currentPrice) / Math.abs(currentPrice - stopLoss)
  );

  return {
    market: `${coin}/USD`,
    price: round(currentPrice, 2),
    signal,
    conviction,
    stopLoss: round(stopLoss, 2),
    takeProfit: round(takeProfit, 2),
    riskRewardRatio,
    indicators: {
      rsi: {
        value: rsi,
        signal:
          rsi > 70
            ? "OVERBOUGHT"
            : rsi < 30
              ? "OVERSOLD"
              : rsi > 50
                ? "BULLISH"
                : "BEARISH",
      },
      macd: {
        line: macd.line,
        signal: macd.signal,
        histogram: macd.histogram,
        signal_direction: macd.histogram > 0 ? "BULLISH" : "BEARISH",
      },
      ema: {
        ema20,
        ema50,
        crossover: ema20 > ema50 ? "BULLISH" : "BEARISH",
      },
      volume: {
        changePercent: volumeChange,
        signal:
          volumeChange > 20
            ? "ABOVE_AVERAGE"
            : volumeChange < -20
              ? "BELOW_AVERAGE"
              : "NORMAL",
      },
    },
    timestamp: new Date().toISOString(),
  };
}
