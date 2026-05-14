import express from "express";
import cors from "cors";
import "dotenv/config";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { Erc7710EvmScheme } from "./scheme.js";
import { generateTradingSignal, isSupportedToken, SUPPORTED_TOKENS } from "./signals.js";
import { PORT, NETWORK_ID, PAY_TO_ADDRESS, FACILITATOR_URL } from "./config.js";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK_ID,
  new Erc7710EvmScheme(facilitatorClient),
);

const app = express();
app.use(cors({ exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"] }));
app.use(express.json({ limit: "1mb" }));

app.use(
  paymentMiddleware(
    {
      "GET /api/premium-data": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: NETWORK_ID,
            payTo: PAY_TO_ADDRESS,
          },
        ],
        description: "Access to premium market data",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// ─── Protected resource ──────────────────────────────────────────────────────

app.get("/api/premium-data", async (req, res) => {
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

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[seller] Server running on http://localhost:${PORT}`);
  console.log(`[seller] Pay-to address: ${PAY_TO_ADDRESS}`);
  console.log(`[seller] Facilitator URL: ${FACILITATOR_URL}`);
  console.log(`[seller] Network: ${NETWORK_ID}`);
});
