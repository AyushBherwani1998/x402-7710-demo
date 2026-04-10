import type { Address, Hex } from "viem";
import { USDC_ADDRESS } from "./delegation";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4402";

export interface PaymentPayload {
  x402Version: number;
  accepted: {
    scheme: string;
    network: string;
    amount: string;
    asset: Address;
    payTo: Address;
    maxTimeoutSeconds: number;
    extra: {
      assetTransferMethod: string;
    };
  };
  payload: {
    delegationManager: Address;
    permissionContext: Hex;
    delegator: Address;
  };
}

export function buildPaymentPayload(params: {
  amount: string;
  payTo: Address;
  delegationManager: Address;
  permissionContext: Hex;
  delegator: Address;
}): PaymentPayload {
  return {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:84532",
      amount: params.amount,
      asset: USDC_ADDRESS,
      payTo: params.payTo,
      maxTimeoutSeconds: 60,
      extra: {
        assetTransferMethod: "erc7710",
      },
    },
    payload: {
      delegationManager: params.delegationManager,
      permissionContext: params.permissionContext,
      delegator: params.delegator,
    },
  };
}

export function encodePaymentHeader(payload: PaymentPayload): string {
  return btoa(JSON.stringify(payload));
}

export async function fetchProtectedResource(
  paymentHeader: string,
  coin = "ETH"
): Promise<{ data: unknown; paymentResponse?: unknown }> {
  const res = await fetch(`${SERVER_URL}/api/premium-data?coin=${coin}`, {
    headers: {
      "payment-signature": paymentHeader,
    },
  });

  const paymentResponseHeader = res.headers.get("payment-response");
  let paymentResponse: unknown;
  if (paymentResponseHeader) {
    try {
      paymentResponse = JSON.parse(atob(paymentResponseHeader));
    } catch {
      // ignore decode errors
    }
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || error.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return { data, paymentResponse };
}

export async function fetchServerInfo(): Promise<{
  facilitatorAddress: Address;
  payToAddress: Address;
  network: string;
  asset: Address;
}> {
  const res = await fetch(`${SERVER_URL}/info`);
  if (!res.ok) {
    throw new Error("Failed to fetch server info");
  }
  return res.json();
}
