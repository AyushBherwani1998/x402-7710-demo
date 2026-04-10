"use client";

import { useState, useCallback } from "react";
import { type Address, type Hex } from "viem";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { grantPermission } from "@/lib/delegation";
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
interface PermissionData {
  permissionContext: Hex;
  delegationManager: Address;
  delegator: Address;
  maxAmount?: string;
  facilitator?: Address;
  grantedAt?: string;
}

interface GrantPermissionProps {
  facilitatorAddress: Address | null;
  onPermissionGranted: (data: PermissionData) => void;
  onPermissionRevoked: () => void;
  permissionData: PermissionData | null;
  delegator: Address;
}

export function GrantPermission({
  facilitatorAddress,
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
    if (!walletClient || !facilitatorAddress) return;
    setIsGranting(true);
    setError(null);

    try {
      const result = await grantPermission({
        walletClient,
        facilitatorAddress,
        delegator,
        maxAmount,
      });

      onPermissionGranted({
        ...result,
        maxAmount,
        facilitator: facilitatorAddress,
        grantedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to grant permission"
      );
    } finally {
      setIsGranting(false);
    }
  }, [
    walletClient,
    facilitatorAddress,
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
            Authorize the facilitator to transfer USDC on your behalf using
            ERC-7715 permissions
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

            {facilitatorAddress ? (
              <div className="rounded-lg border bg-secondary/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Granting to (Facilitator)
                </p>
                <p className="truncate font-mono text-xs">
                  {facilitatorAddress}
                </p>
              </div>
            ) : (
              <p className="text-sm text-warning">
                Loading facilitator address...
              </p>
            )}

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
                disabled={isGranting || !facilitatorAddress || !walletClient}
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
