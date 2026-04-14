"use client";

import { useState, useCallback } from "react";
import { type Address, type Hex } from "viem";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { grantPermission, redelegateToFacilitator } from "@/lib/delegation";
import { getOrCreateEmbeddedAccount } from "@/lib/embedded-account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export interface PermissionData {
  permissionContext: Hex;
  delegationManager: Address;
  delegator: Address;
  maxAmount?: string;
  facilitator?: Address;
  grantedAt?: string;
}

interface GrantPermissionProps {
  facilitatorAddress: Address | null;
  payToAddress: Address | null;
  onPermissionGranted: (data: PermissionData) => void;
  onPermissionRevoked: () => void;
  permissionData: PermissionData | null;
  delegator: Address;
}

export function GrantPermission({
  facilitatorAddress,
  payToAddress,
  onPermissionGranted,
  onPermissionRevoked,
  permissionData,
  delegator,
}: GrantPermissionProps) {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = chainId !== baseSepolia.id;
  const [maxAmount, setMaxAmount] = useState("10");
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantPermission = useCallback(async () => {
    if (!walletClient || !facilitatorAddress || !payToAddress) return;
    setIsGranting(true);
    setError(null);

    try {
      // Step 1: Get or create the embedded EOA for this user
      const { account: embeddedAccount, privateKey: embeddedPrivateKey } =
        getOrCreateEmbeddedAccount(delegator);

      // Step 2: Grant ERC-7715 permission from MetaMask → embedded EOA
      const result = await grantPermission({
        walletClient,
        embeddedEOAAddress: embeddedAccount.address,
        delegator,
        maxAmount,
      });

      // Step 3: Redelegate from embedded EOA → facilitator with caveats
      const redelegatedContext = await redelegateToFacilitator({
        permissionContext: result.permissionContext,
        delegationManager: result.delegationManager,
        embeddedEOAPrivateKey: embeddedPrivateKey,
        embeddedEOAAddress: embeddedAccount.address,
        facilitatorAddress,
        payToAddress,
      });

      onPermissionGranted({
        permissionContext: redelegatedContext,
        delegationManager: result.delegationManager,
        delegator: result.delegator,
        maxAmount,
        facilitator: facilitatorAddress,
        grantedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : typeof err === "string"
              ? err
              : "Failed to grant permission";
      setError(message);
    } finally {
      setIsGranting(false);
    }
  }, [
    walletClient,
    facilitatorAddress,
    payToAddress,
    delegator,
    maxAmount,
    onPermissionGranted,
  ]);

  if (!delegator) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Grant Permission
          {permissionData && (
            <Badge className="border-primary/30 bg-primary/10 text-primary">
              Active
            </Badge>
          )}
        </CardTitle>
        {!permissionData && (
          <CardDescription>
            Allow automatic USDC payments for premium content access
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {permissionData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Token
                </p>
                <p className="mt-1 text-sm font-semibold">USDC</p>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Max Amount / Day
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {permissionData.maxAmount ?? "10"} USDC
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={onPermissionRevoked}
              className="w-full"
            >
              Revoke Permission
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxAmount">Max USDC Amount (per day)</Label>
              <Input
                id="maxAmount"
                type="text"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="10"
              />
            </div>

            {isWrongChain ? (
              <Button
                onClick={() =>
                  switchChain({
                    chainId: baseSepolia.id,
                    addEthereumChainParameter: {
                      chainName: baseSepolia.name,
                      nativeCurrency: baseSepolia.nativeCurrency,
                      rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
                      blockExplorerUrls: [
                        baseSepolia.blockExplorers.default.url,
                      ],
                    },
                  })
                }
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Switch to Base Sepolia
              </Button>
            ) : (
              <Button
                onClick={handleGrantPermission}
                disabled={isGranting || !facilitatorAddress || !payToAddress || !walletClient}
                size="lg"
                className="w-full"
              >
                {isGranting ? "Granting Permission..." : "Grant Permission"}
              </Button>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
