import { type Address } from "viem";
import "dotenv/config";

export const NETWORK_ID = "eip155:84532" as const;

export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS as Address;
if (!PAY_TO_ADDRESS) {
  throw new Error("PAY_TO_ADDRESS environment variable is required");
}

export const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "http://localhost:4403";

export const PORT = parseInt(process.env.PORT || "4402", 10);
