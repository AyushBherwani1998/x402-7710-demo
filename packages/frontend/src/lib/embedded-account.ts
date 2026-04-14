import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

const STORAGE_PREFIX = "x402-embedded-key-";

export function getOrCreateEmbeddedAccount(userAddress: Address): {
  account: ReturnType<typeof privateKeyToAccount>;
  privateKey: Hex;
} {
  const storageKey = `${STORAGE_PREFIX}${userAddress}`;
  let privateKey = localStorage.getItem(storageKey) as Hex | null;

  if (!privateKey) {
    privateKey = generatePrivateKey();
    localStorage.setItem(storageKey, privateKey);
  }

  return {
    account: privateKeyToAccount(privateKey),
    privateKey,
  };
}
