import type { Address, Hex } from "viem";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { redelegateToFacilitator } from "@/lib/delegation";
import { getOrCreateEmbeddedAccount } from "@/lib/embedded-account";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4402";

export function createFetchWithPayment(delegationData: {
  permissionContext: Hex;
  delegationManager: Address;
  delegator: Address;
}): typeof globalThis.fetch {
  const erc7710Client = new x402Erc7710Client({
    delegationProvider: async (_) => {
      const { account, privateKey } = getOrCreateEmbeddedAccount(
        delegationData.delegator
      );

      const permissionContext = await redelegateToFacilitator({
        permissionContext: delegationData.permissionContext,
        delegationManager: delegationData.delegationManager,
        embeddedEOAPrivateKey: privateKey,
        embeddedEOAAddress: account.address,
      });

      return {
        delegationManager: delegationData.delegationManager,
        permissionContext,
        delegator: delegationData.delegator,
      };
    },
  });

  const coreClient = new x402Client().register("eip155:*", erc7710Client);

  return wrapFetchWithPayment(fetch, coreClient);
}

export function getServerUrl(): string {
  return SERVER_URL;
}
