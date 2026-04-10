import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import {
  publicClient,
  walletClient,
  facilitatorAccount,
  erc20Abi,
  delegationManagerAbi,
  SINGLE_DEFAULT_MODE,
  NETWORK_ID,
} from "./config.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExactERC7710Payload = {
  delegationManager: Address;
  permissionContext: Hex;
  delegator: Address;
};

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
      [key: string]: unknown;
    };
  };
  payload: ExactERC7710Payload;
}

export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: {
    assetTransferMethod: string;
    facilitators?: Address[];
    [key: string]: unknown;
  };
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: Address;
}

export interface SettleResult {
  success: boolean;
  transaction?: Hex;
  network?: string;
  errorReason?: string;
  errorMessage?: string;
  payer?: Address;
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isERC7710Payload(
  payload: unknown
): payload is ExactERC7710Payload {
  return (
    !!payload &&
    typeof payload === "object" &&
    "delegationManager" in payload &&
    "permissionContext" in payload &&
    "delegator" in payload
  );
}

// ─── Execution Calldata ─────────────────────────────────────────────────────

/**
 * Builds ERC-7579 single execution calldata for an ERC-20 transfer.
 *
 * Format: abi.encodePacked(target, value, calldata)
 *   - target: 20 bytes (ERC-20 token address)
 *   - value:  32 bytes (0 for token transfer)
 *   - calldata: transfer(to, amount) encoded
 *
 * @see https://eips.ethereum.org/EIPS/eip-7579
 */
function buildExecutionCallData(
  tokenAddress: Address,
  recipient: Address,
  amount: bigint
): Hex {
  const transferCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amount],
  });

  const target = tokenAddress.toLowerCase().slice(2); // 20 bytes
  const value = BigInt(0).toString(16).padStart(64, "0"); // 32 bytes
  const calldata = transferCalldata.slice(2);

  return `0x${target}${value}${calldata}` as Hex;
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validatePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): string | null {
  if (paymentPayload.accepted.scheme !== "exact") {
    return `Unsupported scheme: ${paymentPayload.accepted.scheme}. Expected exact`;
  }
  if (paymentPayload.accepted.network !== paymentRequirements.network) {
    return `Unsupported network: ${paymentPayload.accepted.network}. Expected ${NETWORK_ID}`;
  }
  if (!isERC7710Payload(paymentPayload.payload)) {
    return "Invalid payload: missing delegationManager, permissionContext, or delegator";
  }
  return null;
}

// ─── Verify ─────────────────────────────────────────────────────────────────

/**
 * Verifies an ERC-7710 delegation payment via simulation.
 *
 * Simulates `redeemDelegations()` on the DelegationManager contract
 * to verify the delegation chain is valid without executing on-chain.
 */
export async function verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResult> {
  const validationError = validatePayment(paymentPayload, paymentRequirements);
  if (validationError) {
    return {
      isValid: false,
      invalidReason: "INVALID_PAYLOAD",
      invalidMessage: validationError,
    };
  }

  const { delegationManager, permissionContext, delegator } =
    paymentPayload.payload;
  const erc20Address = getAddress(paymentRequirements.asset);
  const payTo = getAddress(paymentRequirements.payTo);
  const amount = BigInt(paymentRequirements.amount);

  // Check delegator balance first
  try {
    const balance = await publicClient.readContract({
      address: erc20Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [delegator],
    });

    if (balance < amount) {
      return {
        isValid: false,
        invalidReason: "INSUFFICIENT_FUNDS",
        invalidMessage: `Delegator balance ${balance} < required ${amount}`,
        payer: delegator,
      };
    }
  } catch {
    // If balance check fails, continue with simulation
  }

  // Build execution calldata
  const executionCallData = buildExecutionCallData(erc20Address, payTo, amount);

  // Simulate redeemDelegations
  try {
    await publicClient.simulateContract({
      address: delegationManager,
      abi: delegationManagerAbi,
      functionName: "redeemDelegations",
      args: [
        [permissionContext],
        [SINGLE_DEFAULT_MODE],
        [executionCallData],
      ],
      account: facilitatorAccount,
    });

    return { isValid: true, payer: delegator };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Simulation failed";
    return {
      isValid: false,
      invalidReason: "SIMULATION_FAILED",
      invalidMessage: message,
      payer: delegator,
    };
  }
}

// ─── Settle ─────────────────────────────────────────────────────────────────

/**
 * Settles an ERC-7710 delegation payment by calling `redeemDelegations()`.
 *
 * Re-verifies before settling, then executes the on-chain transaction.
 */
export async function settle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  // Re-verify before settling
  const verifyResult = await verify(paymentPayload, paymentRequirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      errorReason: verifyResult.invalidReason,
      errorMessage: verifyResult.invalidMessage,
      payer: verifyResult.payer,
    };
  }

  const { delegationManager, permissionContext, delegator } =
    paymentPayload.payload;
  const erc20Address = getAddress(paymentRequirements.asset);
  const payTo = getAddress(paymentRequirements.payTo);
  const amount = BigInt(paymentRequirements.amount);

  const executionCallData = buildExecutionCallData(erc20Address, payTo, amount);

  try {
    const hash = await walletClient.writeContract({
      address: delegationManager,
      abi: delegationManagerAbi,
      functionName: "redeemDelegations",
      args: [
        [permissionContext],
        [SINGLE_DEFAULT_MODE],
        [executionCallData],
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      return {
        success: false,
        transaction: hash,
        network: NETWORK_ID,
        errorReason: "TRANSACTION_REVERTED",
        errorMessage: "Settlement transaction was reverted",
        payer: delegator,
      };
    }

    return {
      success: true,
      transaction: hash,
      network: NETWORK_ID,
      payer: delegator,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Settlement failed";
    return {
      success: false,
      errorReason: "SETTLEMENT_FAILED",
      errorMessage: message,
      payer: delegator,
    };
  }
}
