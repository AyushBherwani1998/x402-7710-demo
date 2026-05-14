"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { useAccount } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import {
  GrantPermission,
  type PermissionData,
} from "@/components/GrantPermission";
import { ResourceAccess } from "@/components/ResourceAccess";
import {
  fetchPaymentRequirements,
  type PaymentRequirements,
} from "@/lib/x402";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const { isConnected, address } = useAccount();
  const [facilitators, setFacilitators] = useState<Address[]>([]);
  const [accepted, setAccepted] = useState<PaymentRequirements | null>(null);
  const [delegationData, setDelegationData] = useState<PermissionData | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  // Restore delegation data from localStorage when address changes
  useEffect(() => {
    if (!address) {
      setDelegationData(null);
      return;
    }
    try {
      const stored = localStorage.getItem(`x402-delegation-${address}`);
      if (stored) {
        setDelegationData(JSON.parse(stored));
      } else {
        setDelegationData(null);
      }
    } catch {
      setDelegationData(null);
    }
  }, [address]);

  useEffect(() => {
    fetchPaymentRequirements()
      .then((info) => {
        setFacilitators(info.facilitators);
        setAccepted(info.accepted);
      })
      .catch((err) => {
        setServerError(
          `Cannot reach server: ${err.message}. Make sure the server is running on ${process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4402"}.`
        );
      });
  }, []);

  const handlePermissionGranted = useCallback(
    (data: PermissionData) => {
      setDelegationData(data);
      if (address) {
        localStorage.setItem(
          `x402-delegation-${address}`,
          JSON.stringify(data)
        );
      }
    },
    [address]
  );

  const handlePermissionRevoked = useCallback(() => {
    setDelegationData(null);
    if (address) {
      localStorage.removeItem(`x402-delegation-${address}`);
    }
  }, [address]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-2xl px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Base Sepolia Testnet
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Premium Trading Signals
          </h1>
          <p className="mt-3 text-muted-foreground">
            Premium Hyperliquid signals. Pay via x402 + ERC-7710 + Advanced
            Permissions
          </p>
        </div>

        {serverError && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="space-y-6">
          <ConnectWallet />

          {isConnected && address && (
            <GrantPermission
              onPermissionGranted={handlePermissionGranted}
              onPermissionRevoked={handlePermissionRevoked}
              permissionData={delegationData}
              delegator={address}
            />
          )}

          {isConnected && delegationData && accepted && (
            <ResourceAccess
              delegationData={delegationData}
              accepted={accepted}
              facilitators={facilitators}
            />
          )}
        </div>

        <Separator className="my-10 opacity-50" />

        <footer className="text-center text-xs text-muted-foreground">
          <p>
            Built with{" "}
            <a
              href="https://github.com/coinbase/x402"
              className="text-primary/80 transition-colors hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              x402
            </a>
            {" + "}
            <a
              href="https://docs.metamask.io/smart-accounts-kit"
              className="text-primary/80 transition-colors hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              MetaMask Advanced Permissions
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
