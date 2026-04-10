"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary">
                  Connected
                </Badge>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {address}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect()}
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Wallet</CardTitle>
        <CardDescription>
          Connect your wallet to get started with premium trading signals
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(() => {
          const metaMask = connectors.find((c) => c.id === "io.metamask" || c.name === "MetaMask");
          if (!metaMask) return <p className="text-sm text-muted-foreground">MetaMask not detected</p>;
          return (
            <Button
              onClick={() => connect({ connector: metaMask })}
              disabled={isPending}
              size="lg"
              className="w-full"
            >
              {isPending ? "Connecting..." : "Connect MetaMask"}
            </Button>
          );
        })()}
      </CardContent>
    </Card>
  );
}
