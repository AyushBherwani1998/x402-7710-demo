import express from "express";
import cors from "cors";
import "dotenv/config";
import {
  verify,
  settle,
  type PaymentPayload,
  type PaymentRequirements,
} from "./erc7710.js";
import { PORT, NETWORK_ID, USDC_ADDRESS, facilitatorAccount } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Facilitator endpoints ───────────────────────────────────────────────────

app.post("/verify", async (req, res) => {
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
    console.log("[facilitator] Verify result:", result);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.post("/settle", async (req, res) => {
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

app.get("/supported", (_req, res) => {
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

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[facilitator] Running on http://localhost:${PORT}`);
  console.log(`[facilitator] Address: ${facilitatorAccount.address}`);
  console.log(`[facilitator] Network: ${NETWORK_ID}`);
});
