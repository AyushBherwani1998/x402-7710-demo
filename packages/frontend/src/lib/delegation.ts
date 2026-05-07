import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import {
  getSmartAccountsEnvironment,
  signDelegation
} from "@metamask/smart-accounts-kit";
import {
  decodeDelegations,
  encodeDelegations,
  toDelegation,
  hashDelegation,
} from "@metamask/smart-accounts-kit/utils";
import {
  parseUnits,
  type Hex,
  type Address,
  type WalletClient,
} from "viem";
import { base } from "viem/chains";

export const USDC_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Step 1: Grant ERC-7715 permission from MetaMask user to the embedded EOA.
 */
export async function grantPermission(params: {
  walletClient: WalletClient;
  embeddedEOAAddress: Address;
  delegator: Address;
  maxAmount?: string;
}): Promise<{
  permissionContext: Hex;
  delegationManager: Address;
  delegator: Address;
}> {
  const { walletClient, embeddedEOAAddress, delegator, maxAmount = "10" } = params;

  const client = walletClient.extend(erc7715ProviderActions());
  const currentTime = Math.floor(Date.now() / 1000);
  const expiry = currentTime + 30 * 24 * 60 * 60; // 30 days

  const permissions = await client.requestExecutionPermissions([
    {
      chainId: base.id,
      expiry,
      to: embeddedEOAAddress,
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
  const env = getSmartAccountsEnvironment(base.id);

  return {
    permissionContext: permission.context as Hex,
    delegationManager: (permission.delegationManager ?? env.DelegationManager) as Address,
    delegator,
  };
}

/**
 * Step 2: Redelegate from embedded EOA to facilitator — no extra caveats needed
 * because the root delegation from MetaMask already enforces token, method, and
 * spending limit. TX Sentinel uses batch execution mode which is incompatible
 * with the allowedCalldata caveat enforcer (CALLTYPE_SINGLE only).
 */
export async function redelegateToFacilitator(params: {
  permissionContext: Hex;
  delegationManager: Address;
  embeddedEOAPrivateKey: Hex;
  embeddedEOAAddress: Address;
  facilitatorAddress: Address;
}): Promise<Hex> {
  const {
    permissionContext,
    delegationManager,
    embeddedEOAPrivateKey,
    embeddedEOAAddress,
    facilitatorAddress,
  } = params;

  // Decode the original delegation chain from MetaMask
  const originalDelegations = decodeDelegations(permissionContext);
  const rootDelegation = originalDelegations[0];

  const redelegation = toDelegation({
    caveats: [],
    delegate: facilitatorAddress,
    delegator: embeddedEOAAddress,
    authority: hashDelegation(rootDelegation),
    salt: BigInt(0),
    signature: "0x00"
  })


  // Sign the redelegation with the embedded EOA's private key
  const signature = await signDelegation({
    privateKey: embeddedEOAPrivateKey,
    delegation: redelegation,
    delegationManager,
    chainId: base.id,
    allowInsecureUnrestrictedDelegation: true,
  });

  const signedRedelegation = { ...redelegation, signature };

  // Encode the full delegation chain: [redelegation, ...original delegations]
  return encodeDelegations([signedRedelegation, ...originalDelegations]);
}

