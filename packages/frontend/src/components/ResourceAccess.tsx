"use client";

import { useState, useCallback } from "react";
import { type Address, type Hex } from "viem";
import {
  buildPaymentPayload,
  encodePaymentHeader,
  fetchProtectedResource,
  type PaymentRequirements,
} from "@/lib/x402";
import { redelegateToFacilitator } from "@/lib/delegation";
import { getOrCreateEmbeddedAccount } from "@/lib/embedded-account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUPPORTED_TOKENS = ["ETH", "BTC", "SOL", "ZRO", "ZEC"] as const;
type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

interface Indicators {
  rsi: { value: number; signal: string };
  macd: {
    line: number;
    signal: number;
    histogram: number;
    signal_direction: string;
  };
  ema: { ema20: number; ema50: number; crossover: string };
  volume: { changePercent: number; signal: string };
}

interface TradingSignal {
  market: string;
  price: number;
  signal: "LONG" | "SHORT";
  conviction: "HIGH" | "MEDIUM" | "LOW";
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  indicators: Indicators;
  timestamp: string;
}

interface ResourceAccessProps {
  delegationData: {
    permissionContext: Hex;
    delegationManager: Address;
    delegator: Address;
  } | null;
  accepted: PaymentRequirements;
  facilitators: Address[];
}

function IndicatorCard({
  label,
  value,
  signal,
}: {
  label: string;
  value: string;
  signal: string;
}) {
  const isBullish = signal === "BULLISH" || signal === "ABOVE_AVERAGE";
  const isNeutral =
    signal === "OVERBOUGHT" || signal === "OVERSOLD" || signal === "NORMAL";
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <Badge
        variant={
          isBullish ? "default" : isNeutral ? "outline" : "destructive"
        }
        className={`mt-1.5 ${isBullish ? "bg-primary/15 text-primary" : isNeutral ? "border-warning/30 text-warning" : ""}`}
      >
        {signal}
      </Badge>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ResourceAccess({
  delegationData,
  accepted,
  facilitators,
}: ResourceAccessProps) {
  const [selectedToken, setSelectedToken] = useState<SupportedToken>("ETH");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TradingSignal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccess = useCallback(
    async (coin: SupportedToken) => {
      if (!delegationData || facilitators.length === 0) return;
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const { account: embeddedAccount, privateKey: embeddedPrivateKey } =
          getOrCreateEmbeddedAccount(delegationData.delegator);

        const permissionContext = await redelegateToFacilitator({
          permissionContext: delegationData.permissionContext,
          delegationManager: delegationData.delegationManager,
          embeddedEOAPrivateKey: embeddedPrivateKey,
          embeddedEOAAddress: embeddedAccount.address,
          facilitatorAddress: facilitators[0],
        });

        const payload = buildPaymentPayload({
          accepted,
          delegationManager: delegationData.delegationManager,
          permissionContext,
          delegator: delegationData.delegator,
        });

        console.log("[x402] Payment payload delegator:", delegationData.delegator);
        console.log("[x402] Payment payload:", JSON.stringify(payload, null, 2));

        const header = encodePaymentHeader(payload);
        const response = await fetchProtectedResource(header, coin);
        const raw = response.data as Record<string, unknown>;
        const signal = (raw.data ?? raw) as TradingSignal;
        setResult(signal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setIsLoading(false);
      }
    },
    [delegationData, accepted, facilitators]
  );

  if (!delegationData) return null;

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Premium Trading Signals</CardTitle>
          <CardDescription>
            Real-time signals from Hyperliquid with RSI, MACD, EMA, and volume
            analysis. Each request is settled on-chain via ERC-7710.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Select Token
            </p>
            <Select
              value={selectedToken}
              onValueChange={(v) => setSelectedToken(v as SupportedToken)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token} value={token}>
                    {token}/USD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-secondary/30 p-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Cost per request
              </p>
              <p className="text-sm font-semibold">0.01 USDC</p>
            </div>
            <Badge variant="outline">ERC-7710</Badge>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => handleAccess(selectedToken)}
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Fetching {selectedToken} Signal...
              </span>
            ) : (
              `Get ${selectedToken}/USD Signal`
            )}
          </Button>
        </CardFooter>
        {error && (
          <div className="px-4 pb-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </Card>
    );
  }

  const isLong = result.signal === "LONG";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {result.market}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                ${result.price.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedToken}
              onValueChange={(v) => {
                const token = v as SupportedToken;
                setSelectedToken(token);
                handleAccess(token);
              }}
            >
              <SelectTrigger className="!h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token} value={token}>
                    {token}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              className={`flex h-9 items-center px-5 text-lg font-bold ${
                isLong
                  ? "bg-primary/15 text-primary hover:bg-primary/20"
                  : "bg-destructive/15 text-destructive hover:bg-destructive/20"
              }`}
            >
              {result.signal}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Conviction / SL / TP */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-secondary/30 p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Conviction
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                result.conviction === "HIGH"
                  ? "text-primary"
                  : result.conviction === "MEDIUM"
                    ? "text-warning"
                    : "text-destructive"
              }`}
            >
              {result.conviction}
            </p>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Stop Loss
            </p>
            <p className="mt-1 text-xl font-bold text-destructive">
              ${result.stopLoss.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Take Profit
            </p>
            <p className="mt-1 text-xl font-bold text-primary">
              ${result.takeProfit.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Risk/Reward bar */}
        <div className="rounded-lg border bg-secondary/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Risk / Reward
            </p>
            <p className="text-sm font-bold text-foreground">
              1 : {result.riskRewardRatio}
            </p>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="rounded-full bg-destructive/60"
              style={{
                width: `${(1 / (1 + result.riskRewardRatio)) * 100}%`,
              }}
            />
            <div
              className="rounded-full bg-primary/60"
              style={{
                width: `${(result.riskRewardRatio / (1 + result.riskRewardRatio)) * 100}%`,
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Risk</span>
            <span>Reward</span>
          </div>
        </div>

        <Separator />

        {/* Indicators */}
        <div>
          <p className="mb-3 text-sm font-semibold">Technical Indicators</p>
          <div className="grid grid-cols-2 gap-3">
            <IndicatorCard
              label="RSI (14)"
              value={result.indicators.rsi.value.toString()}
              signal={result.indicators.rsi.signal}
            />
            <IndicatorCard
              label="MACD Histogram"
              value={`${result.indicators.macd.histogram > 0 ? "+" : ""}${result.indicators.macd.histogram}`}
              signal={result.indicators.macd.signal_direction}
            />
            <IndicatorCard
              label="EMA (20 / 50)"
              value={`${result.indicators.ema.ema20.toLocaleString()} / ${result.indicators.ema.ema50.toLocaleString()}`}
              signal={result.indicators.ema.crossover}
            />
            <IndicatorCard
              label="Volume vs Avg"
              value={`${result.indicators.volume.changePercent > 0 ? "+" : ""}${result.indicators.volume.changePercent}%`}
              signal={result.indicators.volume.signal}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {new Date(result.timestamp).toLocaleString()}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAccess(selectedToken)}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Refreshing...
            </span>
          ) : (
            "Refresh (0.01 USDC)"
          )}
        </Button>
      </CardFooter>

      {error && (
        <div className="px-4 pb-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </Card>
  );
}
