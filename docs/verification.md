# Verifying the mainnet deployment yourself

Nothing here needs a key or an account. Every step reads public chain state.

## 1. The contract is owned by an ordinary wallet

```
cd tools && npm install
node verify-deployment.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4
```

Expected: `owner` and `treasury` both read `0x865AcA7b2be3c3886d4c7bdDcf3Cd17dc1b2Db2A`,
withholding 300 bps, USDC `0x3600...0000`.

The explorer shows the same wallet as the contract creator, so the deployment did not go
through the Arc Studio platform account.

## 2. The mainnet runtime matches the build tested on testnet

```
node verify-deployment.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4 \
  testnet 0x038d0d457abb5a26cc95c4ea067df48dca5a36c4
```

Expected: `runtime match : identical`. The two were deployed from different accounts on
different chains; identical runtime means the mainnet contract is the code that was
exercised on testnet, not a rebuild.

## 3. Real USDC moved through it

```
node read-history.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4
```

The mainnet explorer API is behind a Cloudflare challenge, so the script falls back to
scanning recent blocks. The first payout is older than that window, so read it directly:

https://explorer.arc.io/tx/0xa08d370e3d1285ae851a6df4e4bdda6db69941f2d54cf6ad13e0f5e0527d4657

The transfer list shows three legs: 0.10 USDC into the contract, 0.097 out to the
recipient, 0.003 out to the treasury.

## 4. Reproducing the deployment path

```
node extract-creation-bytecode.js testnet <contract> <studioDeployTx> creation.hex
node encode-constructor-args.js creation.hex <treasury> 300 <owner> creation.args.hex
node deploy-contract.js testnet creation.args.hex <keyfile>          # dry run
node deploy-contract.js testnet creation.args.hex <keyfile> --yes    # sends it
```

Deploying the extracted blob on testnet first and comparing the runtime against the
original is what proves the extraction was faithful before any mainnet gas is spent.
