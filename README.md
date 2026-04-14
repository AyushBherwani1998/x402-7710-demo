# x402 + ERC-7710 with MetaMask Advanced Permissions

A pnpm monorepo implementing the [x402](https://github.com/coinbase/x402) payment protocol with [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710) smart account delegations, powered by [MetaMask Advanced Permissions](https://docs.metamask.io/smart-accounts-kit/development/guides/advanced-permissions/) (EIP-7715).

## Architecture

```
Frontend (Next.js)         Seller (Express)            Facilitator (Express)
┌─────────────────┐        ┌───────────────────┐       ┌──────────────────┐
│ 1. Connect      │        │ Protected Resource│       │ POST /verify     │
│ 2. Grant Perm.  │──sig──▶│  GET /api/premium │──────▶│ POST /settle     │
│ 3. Access       │◀─data──│  GET /info        │◀──────│ GET  /supported  │
└─────────────────┘        └───────────────────┘       └──────────────────┘
  :3402                      :4402                       :4403
```

**Roles:**
- **Seller** — owns the protected resource, declares payment terms (`payTo` address), delegates verification and settlement to the facilitator via HTTP
- **Facilitator** — independent service that verifies delegations (via simulation) and settles payments on-chain; holds the private key for gas but never receives payment funds

**Flow:**
1. User connects MetaMask (must be [upgraded to a Smart Account](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/))
2. User grants an ERC-7715 permission to an embedded EOA via MetaMask Advanced Permissions — scoped to periodic USDC transfers
3. The embedded EOA redelegates to the facilitator with caveats: `redeemer` (only the facilitator can redeem) and `allowedCalldata` (enforces the seller's `payTo` address as the transfer recipient)
4. The full delegation chain is encoded in an x402 `payment-signature` header and sent with the request to the seller
5. Seller forwards the payment to the facilitator for verification (simulation of `redeemDelegations`)
6. Seller returns the premium data, then the facilitator settles the payment on-chain

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

### 2. Configure the facilitator

```bash
cp packages/facilitator/.env.example packages/facilitator/.env
```

Edit `packages/facilitator/.env`:

```env
# Facilitator private key (needs Base Sepolia ETH for gas)
EVM_PRIVATE_KEY=0x...

# Facilitator port (default: 4403)
PORT=4403
```

### 3. Configure the seller

```bash
cp packages/server/.env.example packages/server/.env
```

Edit `packages/server/.env`:

```env
# Address that receives USDC payments (the seller's wallet)
PAY_TO_ADDRESS=0x...

# URL of the facilitator service (default: http://localhost:4403)
FACILITATOR_URL=http://localhost:4403

# Seller port (default: 4402)
PORT=4402
```

### 4. Configure the frontend (optional)

```bash
cp packages/frontend/.env.local.example packages/frontend/.env.local
```

The defaults work if all services run locally.

### 5. Run

In separate terminals (or use `pnpm dev` to run all):

```bash
# Start the facilitator
pnpm dev:facilitator

# Start the seller server
pnpm dev:server

# Start the frontend
pnpm dev:frontend
```

- Facilitator: http://localhost:4403
- Seller: http://localhost:4402
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
│   ├── facilitator/
│   │   └── src/
│   │       ├── index.ts        # Express app with /verify, /settle, /supported
│   │       ├── erc7710.ts      # ERC-7710 verify & settle core logic
│   │       └── config.ts       # Chain config, facilitator account, ABIs
│   ├── server/
│   │   └── src/
│   │       ├── index.ts        # Express app (seller) with /api routes
│   │       ├── middleware.ts    # x402 payment middleware (calls facilitator via HTTP)
│   │       ├── types.ts        # Shared payment types
│   │       ├── signals.ts      # Trading signal generation (Hyperliquid)
│   │       └── config.ts       # Seller config (PAY_TO_ADDRESS, FACILITATOR_URL)
│   └── frontend/
│       └── src/
│           ├── app/            # Next.js App Router pages
│           ├── components/     # ConnectWallet, GrantPermission, ResourceAccess
│           └── lib/            # Wagmi config, delegation helpers, x402 utils
├── package.json
└── pnpm-workspace.yaml
```

## Key Endpoints

### Facilitator (`:4403`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Verify an ERC-7710 payment via simulation |
| `/settle` | POST | Settle an ERC-7710 payment on-chain |
| `/supported` | GET | List supported payment methods |

### Seller (`:4402`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/premium-data` | GET | Protected resource (requires `payment-signature` header) |
| `/info` | GET | Server configuration for frontend discovery |
