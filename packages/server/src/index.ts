import express from "express";
import cors from "cors";
import "dotenv/config";
import { type Address } from "viem";
import { createPaymentMiddleware } from "./middleware.js";
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

let facilitatorAddress: Address | null = null;

async function fetchFacilitatorAddress(): Promise<Address> {
  const res = await fetch(`${FACILITATOR_URL}/platform/v2/x402/supported`);
  if (!res.ok) throw new Error("Failed to fetch facilitator supported info");
  const data = await res.json();
  const signers: Address[] | undefined =
    data.signers?.[NETWORK_ID] ?? data.signers?.["eip155:*"];
  if (signers && signers.length > 0) return signers[0];
  throw new Error("Facilitator address not found in /supported response");
}

// ─── Protected resource ──────────────────────────────────────────────────────

const premiumPaymentMiddleware = createPaymentMiddleware({
  amount: "10000", // 0.01 USDC (6 decimals)
  description: "Access to premium market data",
  mimeType: "application/json",
  getFacilitatorAddress: () => facilitatorAddress,
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

app.get("/info", (_req, res) => {
  res.json({
    payToAddress: PAY_TO_ADDRESS,
    facilitatorAddress,
    network: NETWORK_ID,
    asset: USDC_ADDRESS,
    supportedMethods: ["erc7710"],
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    facilitatorAddress = await fetchFacilitatorAddress();
    console.log(`[seller] Facilitator address: ${facilitatorAddress}`);
  } catch (err) {
    console.warn(`[seller] Could not fetch facilitator address: ${err instanceof Error ? err.message : err}`);
  }

  app.listen(PORT, () => {
    console.log(`[seller] Server running on http://localhost:${PORT}`);
    console.log(`[seller] Pay-to address: ${PAY_TO_ADDRESS}`);
    console.log(`[seller] Facilitator URL: ${FACILITATOR_URL}`);
    console.log(`[seller] Network: ${NETWORK_ID}`);
  });
}

start();
