# ARCone — Cross-border B2B Payout Platform

> Built with Arc Studio · Invoice · Payouts · Tax — on USDC · Built on Arc

---

## What This App Does

ARCone is a B2B payout platform for cross-border payments on Arc Testnet.
- Send USDC to contractors anywhere in the world, settled in <2 seconds
- Automatic 3% withholding tax split on every payout — withheld amount goes to treasury
- On-chain WHT receipt per transaction (PND.53-ready concept)
- Create invoices and share a payment link — client pays with one click
- Non-custodial: keys never leave the user's device

---

## Deployed Contracts (Arc Testnet, Chain ID 5042002)

| Contract | Address | Explorer |
|---|---|---|
| ArconePayouts v2 | `0x038d0d457abb5a26cc95c4ea067df48dca5a36c4` | [View](https://explorer.testnet.arc.io/address/0x038d0d457abb5a26cc95c4ea067df48dca5a36c4) |
| ArconeInvoice v2 | `0x486bce2f393f46e2b422fa851ef0c7b5b3b6a083` | [View](https://explorer.testnet.arc.io/address/0x486bce2f393f46e2b422fa851ef0c7b5b3b6a083) |
| ArconePayouts v1 (deprecated) | `0x31ccb0a6f30acb34a65b0e6df74c66be026ddf62` | owner = platform wallet, uncontrollable |
| ArconeInvoice v1 (deprecated) | `0xbb1fc6f76edbc094963608b9163e7418436dc22f` | owner = platform wallet, uncontrollable |
| THBTToken (legacy) | `0x2c8b48321deb9ebaed13c03403ee3a183d6dd9ff` | [View](https://explorer.testnet.arc.io/address/0x2c8b48321deb9ebaed13c03403ee3a183d6dd9ff) |
| UsdcToThbtGateway (legacy) | `0x44a80bdebe968139477bdc59a506d25cc69ad42a` | [View](https://explorer.testnet.arc.io/address/0x44a80bdebe968139477bdc59a506d25cc69ad42a) |

USDC on Arc Testnet: `0x3600000000000000000000000000000000000000` (6 decimals)
Default withholdingBps: 300 (= 3%)
Owner + Treasury (v2): `0x660945a13eE097674fEF9AEd50dA3Fa2C930BD65` (user-controlled)

---

## Live Deployments

| Target | URL |
|---|---|
| Hugging Face (static) | https://phulimphad-app-574d7c35-f816-4f63-8605-0c80b4e2ff0e.static.hf.space |
| Arc Community Post | https://community.arc.io (pending review as of 2026-10-09) |

---

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS v3
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity ^0.8.24, Foundry (forge build / forge test)
- Chain: Arc Testnet (Chain ID 5042002, `arcTestnet` from `viem/chains`)
- Wallet: injected (MetaMask, WalletConnect via ConnectKit)
- Toasts: Sonner

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root router — landing / dashboard / invoice pay page |
| `src/components/LandingPage.tsx` | Hero landing page with CTA + stats |
| `src/components/ArconeDashboard.tsx` | Main dashboard — payouts, WHT receipts, invoices tabs |
| `src/components/SendPayoutModal.tsx` | New payout modal — approve USDC + call sendPayout() |
| `src/components/CreateInvoiceModal.tsx` | Create invoice modal |
| `src/components/InvoicePayPage.tsx` | Public /invoice/:id pay page |
| `src/components/ArconeLockup.tsx` | Shared logo lockup component (SINGLE source for logo.png + arc_one.png) |
| `src/contracts/ArconePayouts.ts` | ABI + address for ArconePayouts contract |
| `src/contracts/ArconeInvoice.ts` | ABI + address for ArconeInvoice contract |
| `src/config.ts` | wagmi config |
| `contracts/ArconePayouts.sol` | Payout + WHT split contract |
| `contracts/ArconeInvoice.sol` | Invoice creation + payment contract |

---

## Roadmap (not yet built)

- Batch payouts — pay multiple contractors in one transaction
- PDF/CSV export of WHT receipts for accounting
- PromptPay QR for Thai fiat onramp
- Historical event fetch from block explorer API

---

## To Run

```bash
bun install
bun run dev
```

Build contracts: `forge build`
Test contracts: `forge test`
