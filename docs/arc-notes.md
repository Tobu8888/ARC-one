# Notes on building against Arc

Everything here was measured against the live chains while building ARCone, not taken
from documentation. Dates are when the measurement was made.

## USDC appears twice and it is the same money

Arc uses USDC as the native gas token with 18 decimals, and also exposes it as an ERC-20
predeploy at `0x3600000000000000000000000000000000000000` with 6 decimals. A wallet's
native balance and its ERC-20 balance track each other. Adding them together double counts.

Contracts that pull funds use the ERC-20 interface, so a payout still needs `approve`
before `sendPayout`.

## The chain's advertised RPC hosts are dead (30 Oct 2026)

`rpc.testnet.arc.network`, `rpc.quicknode.testnet.arc.network` and
`rpc.blockdaemon.testnet.arc.network` all return NXDOMAIN. The endpoint that answers is
`https://rpc.testnet.arc.io`, and `https://rpc.mainnet.arc.io` for mainnet. Libraries
that carry a built-in chain definition may still hand out the dead hosts, so the
transport has to be set explicitly.

## eth_getLogs caps at 10,000 blocks, and the RPC rate limits

A range of 10,000 blocks is accepted; 10,001 returns `-32012 requested range too large`.
Firing requests back to back produces `-32005` and HTTP 429 after a handful of calls; 20
parallel requests lost 14 of 20 in one test.

Scanning a contract's whole history from a browser is therefore not workable. On testnet
the first ArconePayouts sat 2.48M blocks behind the head, which is 248 sequential calls.

What works instead:

- the Blockscout API, `GET <explorer>/api/v2/addresses/<address>/logs`, returns the whole
  log history in one paginated call and sends `access-control-allow-origin: *`
- `multicall3` is deployed at the canonical `0xcA11bde05977b3631167028862bE2a173976CA11`,
  so reading many contract records is one call rather than N

The mainnet explorer API sits behind a Cloudflare challenge and answers API requests with
403, so tooling that runs outside a browser needs the RPC fallback.

## Block timing

Blocks land about every 0.55 seconds; a payout transaction confirmed in under a second in
the explorer's own reading. Wall-clock time measured from a script is longer because the
client polls.

## Gas, measured from receipts

| Action | Gas | Cost |
| --- | --- | --- |
| `approve` | 55,438 | 0.0012 USDC |
| `sendPayout` | 104,085 | 0.0022 USDC |
| Deploy ArconePayouts | 629,485 | 0.0126 USDC |

A full payout costs about 0.004 USDC, which is ten times the cost of a plain transfer.
Quoting the transfer figure for a payout understates it.

## Decoding a named tuple with viem

`getInvoice` returns a tuple whose components have names, so `decodeFunctionResult`
returns an object rather than an array. Reading it with numeric indexes yields `undefined`
for every field, and the resulting throw escapes any promise that is not caught, which
leaves a spinner on screen forever instead of an error.
