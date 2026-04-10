import { baseSepolia } from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

export const chain = baseSepolia;
export const NETWORK_ID = `eip155:${chain.id}` as const;

export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ERC-7579 single-call execution mode
export const SINGLE_DEFAULT_MODE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const privateKey = process.env.EVM_PRIVATE_KEY as Hex;
if (!privateKey) {
  throw new Error("EVM_PRIVATE_KEY environment variable is required");
}

export const facilitatorAccount = privateKeyToAccount(privateKey);

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

export const walletClient = createWalletClient({
  account: facilitatorAccount,
  chain,
  transport: http(),
});

export const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS as Address;

export const PORT = parseInt(process.env.PORT || "4402", 10);

export const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const delegationManagerAbi = [
  {
    name: "redeemDelegations",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_permissionContexts", type: "bytes[]" },
      { name: "_modes", type: "bytes32[]" },
      { name: "_executionCallDatas", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;
