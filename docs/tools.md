# Using the tools

```
cd tools
npm install
```

Scripts take the network name (`mainnet` or `testnet`) as the first argument.
Anything that spends money does a dry run first and only sends with `--yes`.

Key files are JSON with a `privateKey` field and live outside the repository.
Pass the path as an argument or set `ARCONE_KEYFILE`.

## Looking around

```
node check-rpc.js testnet                       # getLogs cap and rate limiting
node verify-deployment.js mainnet <contract>    # owner, treasury, rate, token
node read-history.js testnet <contract> [payer] # payouts, newest first
```

`verify-deployment.js` takes an optional reference deployment and compares runtime
bytecode, which is how the mainnet contract was checked against the testnet build:

```
node verify-deployment.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4 \
  testnet 0x038d0d457abb5a26cc95c4ea067df48dca5a36c4
```

## Paying

One payout:

```
node send-payout.js testnet <contract> <recipient> 1.50 "design fee" key.json
node send-payout.js testnet <contract> <recipient> 1.50 "design fee" key.json --yes
```

A list of contractors from CSV (see `examples/payouts.csv`):

```
node batch-payout.js testnet <contract> payouts.csv key.json
node batch-payout.js testnet <contract> payouts.csv key.json --yes
```

The batch approves the whole total once and then sends one transaction per row,
because the contract has no batch entry point. If a row fails, the run stops and
prints `--from n` to resume from, so nothing is paid twice.

Both commands keep a small gas reserve, since gas on Arc comes out of the same
USDC balance being sent.

## Accounting export

```
node export-wht.js testnet <contract> --sender <payer> \
  --from 2026-10-01 --to 2026-10-31 --csv october.csv --html october.html
```

Columns: receipt id, date, payer, payee, gross, rate, withheld, net, memo,
transaction, explorer link. The HTML version prints to PDF from a browser.
`examples/wht-export-testnet.csv` is a real export from testnet payouts.

The receipt id is `WHT-` plus the first four bytes of the transaction hash, which
is how the app labels receipts too, so the export and the UI agree.

## Redeploying a Studio build from your own key

```
node extract-creation-bytecode.js testnet <contract> <studioDeployTx> creation.hex
node encode-constructor-args.js creation.hex <treasury> 300 <owner> creation.args.hex
node deploy-contract.js testnet creation.args.hex key.json --yes
node verify-deployment.js testnet <newContract> testnet <contract>
```

The last step is the one that matters: identical runtime means the redeployment is
the same code, now owned by a key you hold.
