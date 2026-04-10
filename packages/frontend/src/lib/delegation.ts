import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import {
  parseUnits,
  type Hex,
  type Address,
  type WalletClient,
} from "viem";
import { baseSepolia } from "viem/chains";

export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export async function grantPermission(params: {
  walletClient: WalletClient;
  facilitatorAddress: Address;
  delegator: Address;
  maxAmount?: string;
}): Promise<{
  permissionContext: Hex;
  delegationManager: Address;
  delegator: Address;
}> {
  const { walletClient, facilitatorAddress, delegator, maxAmount = "10" } = params;

  const client = walletClient.extend(erc7715ProviderActions());
  const currentTime = Math.floor(Date.now() / 1000);
  const expiry = currentTime + 30 * 24 * 60 * 60; // 30 days

  const permissions = await client.requestExecutionPermissions([
    {
      chainId: baseSepolia.id,
      expiry,
      to: facilitatorAddress,
      permission: {
        type: "erc20-token-periodic",
        data: {
          tokenAddress: USDC_ADDRESS,
          periodAmount: parseUnits(maxAmount, 6),
          periodDuration: 86400,
          justification: "Permission to transfer USDC for x402 payments",
        },
        isAdjustmentAllowed: true,
      },
    },
  ]);

  const permission = permissions[0];
  const env = getSmartAccountsEnvironment(baseSepolia.id);

  return {
    permissionContext: permission.context as Hex,
    delegationManager: (permission.delegationManager ?? env.DelegationManager) as Address,
    delegator,
  };
}

export function getEnvironment() {
  return getSmartAccountsEnvironment(baseSepolia.id);
}
