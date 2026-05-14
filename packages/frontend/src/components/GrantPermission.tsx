"use client";

import { useState, useCallback } from "react";
import { type Address, type Hex } from "viem";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { grantPermission } from "@/lib/delegation";
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
  grantedAt?: string;
}

interface GrantPermissionProps {
  onPermissionGranted: (data: PermissionData) => void;
  onPermissionRevoked: () => void;
  permissionData: PermissionData | null;
  delegator: Address;
}

export function GrantPermission({
  onPermissionGranted,
  onPermissionRevoked,
  permissionData,
  delegator,
}: GrantPermissionProps) {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = chainId !== base.id;
  const [maxAmount, setMaxAmount] = useState("10");
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantPermission = useCallback(async () => {
    if (!walletClient) return;
    setIsGranting(true);
    setError(null);

    try {
      const { account: embeddedAccount } =
        getOrCreateEmbeddedAccount(delegator);

      const result = await grantPermission({
        walletClient,
        embeddedEOAAddress: embeddedAccount.address,
        delegator,
        maxAmount,
      });

      onPermissionGranted({
        permissionContext: result.permissionContext,
        delegationManager: result.delegationManager,
        delegator: result.delegator,
        maxAmount,
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
  }, [walletClient, delegator, maxAmount, onPermissionGranted]);

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
                    chainId: base.id,
                    addEthereumChainParameter: {
                      chainName: base.name,
                      nativeCurrency: base.nativeCurrency,
                      rpcUrls: [base.rpcUrls.default.http[0]],
                      blockExplorerUrls: [base.blockExplorers.default.url],
                    },
                  })
                }
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Switch to Base
              </Button>
            ) : (
              <Button
                onClick={handleGrantPermission}
                disabled={isGranting || !walletClient}
                size="lg"
                className="w-full"
              >
                {isGranting ? "Granting Permission..." : "Grant Permission"}
              </Button>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
