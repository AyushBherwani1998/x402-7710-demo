import express from "express";
import cors from "cors";
import "dotenv/config";
import { createPaymentMiddleware, getFacilitatorAddress } from "./middleware.js";
import { generateTradingSignal, isSupportedToken, SUPPORTED_TOKENS } from "./signals.js";
import {
  PORT,
  NETWORK_ID,
  USDC_ADDRESS,
  PAY_TO_ADDRESS,
  FACILITATOR_URL,
} from "./config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Protected resource ──────────────────────────────────────────────────────

const premiumPaymentMiddleware = createPaymentMiddleware({
  amount: "10000", // 0.01 USDC (6 decimals)
  description: "Access to premium market data",
  mimeType: "application/json",
});

app.get("/api/premium-data", premiumPaymentMiddleware, async (req, res) => {
  try {
    const coin = ((req.query.coin as string) || "ETH").toUpperCase();
    if (!isSupportedToken(coin)) {
      res.status(400).json({
        error: `Unsupported token: ${coin}. Supported: ${SUPPORTED_TOKENS.join(", ")}`,
      });
      return;
    }
    const signal = await generateTradingSignal(coin);
    res.json({ data: signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate signal";
    console.error("[x402] Signal generation error:", message);
    res.status(500).json({ error: message });
  }
});

// ─── Info endpoint for frontend discovery ────────────────────────────────────

app.get("/info", async (_req, res) => {
  try {
    const facilitatorAddress = await getFacilitatorAddress();
    res.json({
      facilitatorAddress,
      payToAddress: PAY_TO_ADDRESS,
      network: NETWORK_ID,
      asset: USDC_ADDRESS,
      supportedMethods: ["erc7710"],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Facilitator unavailable";
    res.status(503).json({ error: message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[seller] Server running on http://localhost:${PORT}`);
  console.log(`[seller] Pay-to address: ${PAY_TO_ADDRESS}`);
  console.log(`[seller] Facilitator URL: ${FACILITATOR_URL}`);
  console.log(`[seller] Network: ${NETWORK_ID}`);
  try {
    const addr = await getFacilitatorAddress();
    console.log(`[seller] Facilitator address: ${addr}`);
  } catch (err) {
    console.warn(`[seller] Could not reach facilitator at startup — will retry on first request`);
  }
});
