# ARCone

Cross-border USDC payouts with withholding tax handled in the same transaction, running
on Arc.

A Thai company paying an overseas contractor has to withhold 3% at source and keep a
record it can file. A bank wire gives back a reference number, and the tax record gets
rebuilt by hand afterwards. ARCone does both at once: the contract takes the gross
amount, sends 97% to the contractor, routes 3% to a treasury address, and emits an event
carrying gross, withheld, net and memo. The filing trail is the transaction.

- Live app: https://phulimphad-app-574d7c35-f816-4f63-8605-0c80b4e2ff0e.static.hf.space
- Mainnet contract: [`0x0F225c0F…Ca79ea4`](https://explorer.arc.io/address/0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4)
- Example payout: [`0xa08d370e…27d4657`](https://explorer.arc.io/tx/0xa08d370e3d1285ae851a6df4e4bdda6db69941f2d54cf6ad13e0f5e0527d4657)

Non-custodial throughout: the payer signs every transfer, no key leaves their device, and
the app never holds funds.

## Repository layout

| Path | What it holds |
| --- | --- |
| `tools/` | Deployment and verification scripts (Node, ethers v6) |
| `docs/arc-notes.md` | RPC limits, gas costs and other findings measured on Arc |
| `docs/verification.md` | How to check the mainnet deployment without trusting this README |
| `DEPLOYMENTS.md` | Every deployed address, with the transactions behind them |
| `brand.md`, `*.png`, `*.svg` | Logo files the app loads directly from this repo |

## Working with the tools

```
cd tools
npm install
node check-rpc.js mainnet
node verify-deployment.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4
```

Scripts that spend money take a key file path and do a dry run unless `--yes` is passed.
Key files stay outside the repository; `tools/.gitignore` keeps `wallet.json` and `.env`
out of commits.

## Status

The payouts contract is live on Arc mainnet with real USDC through it. The invoice
contract, the dashboard and the receipt views run on Arc testnet. Batch payouts and a
withholding receipt export for accounting are not built yet.
