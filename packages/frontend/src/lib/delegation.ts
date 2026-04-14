import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import {
  getSmartAccountsEnvironment,
  signDelegation,
} from "@metamask/smart-accounts-kit";
import {
  decodeDelegations,
  encodeDelegations,
  createCaveatBuilder,
  toDelegation,
  hashDelegation,
} from "@metamask/smart-accounts-kit/utils";
import {
  parseUnits,
  encodeAbiParameters,
  toFunctionSelector,
  type Hex,
  type Address,
  type WalletClient,
} from "viem";
import { baseSepolia } from "viem/chains";

export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

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
      chainId: baseSepolia.id,
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
  const env = getSmartAccountsEnvironment(baseSepolia.id);

  return {
    permissionContext: permission.context as Hex,
    delegationManager: (permission.delegationManager ?? env.DelegationManager) as Address,
    delegator,
  };
}

/**
 * Step 2: Redelegate from embedded EOA to the facilitator with caveats.
 *
 * Adds:
 *  - redeemer: only the facilitator can redeem
 *  - allowedCalldata: enforces the PAY_TO address as the transfer recipient
 *    (checks bytes 4–35 of calldata, skipping the function selector)
 */
export async function redelegateToFacilitator(params: {
  permissionContext: Hex;
  delegationManager: Address;
  embeddedEOAPrivateKey: Hex;
  embeddedEOAAddress: Address;
  facilitatorAddress: Address;
  payToAddress: Address;
}): Promise<Hex> {
  const {
    permissionContext,
    delegationManager,
    embeddedEOAPrivateKey,
    embeddedEOAAddress,
    facilitatorAddress,
    payToAddress,
  } = params;

  const env = getSmartAccountsEnvironment(baseSepolia.id);

  // Decode the original delegation chain from MetaMask
  const originalDelegations = decodeDelegations(permissionContext);
  const rootDelegation = originalDelegations[0];

  // Encode the PAY_TO address for the calldata check (enforce transfer recipient)
  const encodedPayTo = encodeAbiParameters(
    [{ type: "address" }],
    [payToAddress],
  );

  // Build caveats for the redelegation
  const caveats = createCaveatBuilder(env)
    .addCaveat("redeemer", { redeemers: [facilitatorAddress] })
    .addCaveat("allowedCalldata", { startIndex: 4, value: encodedPayTo });


  // Create the redelegation: embedded EOA → facilitator
  const redelegation = toDelegation({
    caveats: caveats.build(),
    delegate: facilitatorAddress,
    delegator: embeddedEOAAddress,
    authority: hashDelegation(rootDelegation),
    salt: BigInt(0),
    signature: "0x00",
  })


  // Sign the redelegation with the embedded EOA's private key
  const signature = await signDelegation({
    privateKey: embeddedEOAPrivateKey,
    delegation: redelegation,
    delegationManager,
    chainId: baseSepolia.id,
  });

  const signedRedelegation = { ...redelegation, signature };

  // Encode the full delegation chain: [redelegation, ...original delegations]
  return encodeDelegations([signedRedelegation, ...originalDelegations]);
}

