import express from "express";
import cors from "cors";
import "dotenv/config";
import { verify, settle, type PaymentPayload, type PaymentRequirements } from "./erc7710.js";
import { createPaymentMiddleware } from "./middleware.js";
import { generateTradingSignal, isSupportedToken, SUPPORTED_TOKENS } from "./signals.js";
import {
  PORT,
  NETWORK_ID,
  USDC_ADDRESS,
  facilitatorAccount,
  PAY_TO_ADDRESS,
} from "./config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Facilitator endpoints ───────────────────────────────────────────────────

app.post("/facilitator/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res
        .status(400)
        .json({ error: "Missing paymentPayload or paymentRequirements" });
      return;
    }

    const result = await verify(paymentPayload, paymentRequirements);
    console.log(result);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.post("/facilitator/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res
        .status(400)
        .json({ error: "Missing paymentPayload or paymentRequirements" });
      return;
    }

    const result = await settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/facilitator/supported", (_req, res) => {
  res.json({
    supported: [
      {
        scheme: "exact",
        network: NETWORK_ID,
        asset: USDC_ADDRESS,
        extra: {
          assetTransferMethod: "erc7710",
          facilitators: [facilitatorAccount.address],
        },
      },
    ],
    facilitatorAddress: facilitatorAccount.address,
  });
});

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

app.get("/info", (_req, res) => {
  res.json({
    facilitatorAddress: facilitatorAccount.address,
    payToAddress: PAY_TO_ADDRESS,
    network: NETWORK_ID,
    asset: USDC_ADDRESS,
    supportedMethods: ["erc7710"],
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[x402-erc7710] Facilitator server running on http://localhost:${PORT}`);
  console.log(`[x402-erc7710] Facilitator address: ${facilitatorAccount.address}`);
  console.log(`[x402-erc7710] Pay-to address: ${PAY_TO_ADDRESS}`);
  console.log(`[x402-erc7710] Network: ${NETWORK_ID}`);
});
