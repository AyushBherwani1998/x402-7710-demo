# x402 + ERC-7710 with MetaMask Advanced Permissions

A pnpm monorepo implementing the [x402](https://github.com/coinbase/x402) payment protocol with [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710) smart account delegations, powered by [MetaMask Advanced Permissions](https://docs.metamask.io/smart-accounts-kit/development/guides/advanced-permissions/) (EIP-7715).

## Architecture

```
Frontend (Next.js)                    Server (Express)
┌─────────────────┐                   ┌──────────────────────┐
│ 1. Connect      │                   │ Facilitator          │
│ 2. Grant Perm.  │───payment-sig────▶│  POST /verify        │
│ 3. Access       │◀──premium-data────│  POST /settle        │
└─────────────────┘                   │  GET  /supported     │
                                      │                      │
                                      │ Protected Resource   │
                                      │  GET /api/premium-data│
                                      └──────────────────────┘
```

**Flow:**
1. User connects MetaMask (must be [upgraded to a Smart Account](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/))
2. User grants an ERC-7715 permission to the facilitator via MetaMask Advanced Permissions — this returns a `permissionContext` scoped to periodic USDC transfers
3. The `permissionContext` is encoded in an x402 `payment-signature` header and sent with the request
4. Server verifies by simulating `redeemDelegations` on the DelegationManager
5. Server returns the premium data, then settles the payment on-chain

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [pnpm](https://pnpm.io) v8+
- [MetaMask](https://metamask.io) browser extension with Smart Account enabled
- A private key funded with ETH on Base Sepolia (for the facilitator to pay gas)
- USDC on Base Sepolia in the user's MetaMask Smart Account

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the server

```bash
cp packages/server/.env.example packages/server/.env
```

Edit `packages/server/.env`:

```env
# Facilitator private key (needs Base Sepolia ETH for gas)
EVM_PRIVATE_KEY=0x...

# Address that receives USDC payments
PAY_TO_ADDRESS=0x...

# Server port (default: 4402)
PORT=4402
```

### 3. Configure the frontend (optional)

```bash
cp packages/frontend/.env.local.example packages/frontend/.env.local
```

The defaults work if both run locally.

### 4. Run

In separate terminals:

```bash
# Start the facilitator server
pnpm dev:server

# Start the frontend
pnpm dev:frontend
```

- Server: http://localhost:4402
- Frontend: http://localhost:3402

## Usage

1. Open http://localhost:3402
2. Connect your MetaMask wallet (switch to Base Sepolia, ensure Smart Account is enabled)
3. Fund the Smart Account with USDC on Base Sepolia
4. Click **Grant Permission** to authorize the facilitator for periodic USDC transfers
5. Click **Access Premium Data** to send a paid request

## Network & Contracts

| Setting | Value |
|---------|-------|
| Network | Base Sepolia (`eip155:84532`) |
| USDC    | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Delegation Framework | MetaMask Smart Accounts Kit (latest) |

## Project Structure

```
x402-erc7710/
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts        # Express app with routes
│   │       ├── erc7710.ts      # ERC-7710 verify & settle core
│   │       ├── middleware.ts    # x402 payment middleware
│   │       └── config.ts       # Chain, ABI, constants
│   └── frontend/
│       └── src/
│           ├── app/            # Next.js App Router pages
│           ├── components/     # ConnectWallet, GrantPermission, ResourceAccess
│           └── lib/            # Wagmi config, delegation helpers, x402 utils
├── package.json
└── pnpm-workspace.yaml
```

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/facilitator/verify` | POST | Verify an ERC-7710 payment via simulation |
| `/facilitator/settle` | POST | Settle an ERC-7710 payment on-chain |
| `/facilitator/supported` | GET | List supported payment methods |
| `/api/premium-data` | GET | Protected resource (requires `payment-signature` header) |
| `/info` | GET | Server configuration for frontend discovery |
