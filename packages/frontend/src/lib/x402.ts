import type { Address, Hex } from "viem";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4402";

export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: {
    delegationManager: Address;
    permissionContext: Hex;
    delegator: Address;
  };
}

export function buildPaymentPayload(params: {
  accepted: PaymentRequirements;
  delegationManager: Address;
  permissionContext: Hex;
  delegator: Address;
}): PaymentPayload {
  return {
    x402Version: 2,
    accepted: params.accepted,
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

export interface PaymentInfo {
  payToAddress: Address;
  facilitators: Address[];
  accepted: PaymentRequirements;
}

export async function fetchPaymentRequirements(): Promise<PaymentInfo> {
  const res = await fetch(`${SERVER_URL}/api/premium-data`);
  if (res.status !== 402) {
    throw new Error(`Expected 402 response, got ${res.status}`);
  }

  const header = res.headers.get("payment-required");
  if (!header) {
    throw new Error("Missing PAYMENT-REQUIRED header");
  }

  const paymentRequired = JSON.parse(atob(header));
  const accepted = paymentRequired.accepts?.[0] as
    | PaymentRequirements
    | undefined;
  if (!accepted) {
    throw new Error("No payment requirements in 402 response");
  }

  const facilitators = (accepted.extra?.facilitators ?? []) as Address[];
  if (facilitators.length === 0) {
    throw new Error("No facilitator addresses in payment requirements");
  }

  return {
    payToAddress: accepted.payTo,
    facilitators,
    accepted,
  };
}
