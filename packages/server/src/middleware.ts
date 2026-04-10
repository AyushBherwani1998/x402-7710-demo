import type { Request, Response, NextFunction } from "express";
import {
  verify,
  settle,
  type PaymentPayload,
  type PaymentRequirements,
} from "./erc7710.js";
import {
  USDC_ADDRESS,
  NETWORK_ID,
  PAY_TO_ADDRESS,
  facilitatorAccount,
} from "./config.js";

export interface PaymentMiddlewareOptions {
  amount: string;
  description?: string;
  mimeType?: string;
}

export function createPaymentMiddleware(options: PaymentMiddlewareOptions) {
  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: NETWORK_ID,
    amount: options.amount,
    asset: USDC_ADDRESS,
    payTo: PAY_TO_ADDRESS,
    maxTimeoutSeconds: 60,
    extra: {
      assetTransferMethod: "erc7710",
      facilitators: [facilitatorAccount.address],
    },
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader =
      (req.headers["payment-signature"] as string) ||
      (req.headers["x-payment-signature"] as string);

    if (!paymentHeader) {
      const paymentRequired = {
        x402Version: 2,
        accepts: [paymentRequirements],
        facilitatorAddress: facilitatorAccount.address,
        description: options.description || "Payment required to access this resource",
        mimeType: options.mimeType || "application/json",
      };

      const encoded = Buffer.from(
        JSON.stringify(paymentRequired)
      ).toString("base64");

      res.setHeader("PAYMENT-REQUIRED", encoded);
      res.status(402).json({
        error: "Payment Required",
        paymentRequired,
      });
      return;
    }

    let paymentPayload: PaymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      paymentPayload = JSON.parse(decoded);
    } catch {
      res.status(400).json({ error: "Invalid PAYMENT-SIGNATURE header" });
      return;
    }

    const verifyResult = await verify(paymentPayload, paymentRequirements);

    if (!verifyResult.isValid) {
      res.status(402).json({
        error: "Payment verification failed",
        reason: verifyResult.invalidReason,
        message: verifyResult.invalidMessage,
      });
      return;
    }

    // Store payload for settlement after response
    res.locals.paymentPayload = paymentPayload;
    res.locals.paymentRequirements = paymentRequirements;

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Settle asynchronously after sending the response
      settle(
        res.locals.paymentPayload,
        res.locals.paymentRequirements
      )
        .then((settleResult) => {
          console.log(
            "[x402] Settlement:",
            settleResult.success
              ? `tx ${settleResult.transaction}`
              : `failed: ${settleResult.errorMessage}`
          );
        })
        .catch((err) => {
          console.error("[x402] Settlement error:", err);
        });

      const paymentResponse = {
        x402Version: 2,
        scheme: "exact",
        network: NETWORK_ID,
        payer: verifyResult.payer,
      };
      const encodedResponse = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");
      res.setHeader("PAYMENT-RESPONSE", encodedResponse);

      return originalJson(body);
    };

    next();
  };
}
