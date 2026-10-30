# The source in this repo is the code running on mainnet

The contracts were written in Arc Studio and deployed to Arc mainnet from a key held
locally, not by the Studio platform account. This checks that the two ends line up.

## ArconePayouts — byte-identical

The compiled artifact that came out of Arc Studio and the runtime stored at
`0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4` are the same 2,326 bytes, with no
differing byte anywhere.

```
node tools/verify-deployment.js mainnet 0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4
```

## ArconeInvoice — identical apart from one immutable

`0x1D0c34B719E3EE10d1904a80b66F69033E440984` is 4,159 bytes, the same length as the
artifact, and differs in 8 hex characters. They sit where the artifact carries zeros and
the deployed code carries `0x3600000000000000000000000000000000000000`, the USDC address.

That is what an `immutable` looks like: the value is written into the runtime at deploy
time, so a compiled artifact never matches a deployed contract byte for byte unless you
patch the same value in. The rest of the code is unchanged.

## Compiler settings

From `contracts/foundry.toml`, as used by Arc Studio:

```
solc_version    0.8.28
evm_version     paris
optimizer       true, 200 runs
```

Rebuilding locally needs OpenZeppelin in `node_modules` (see `contracts/remappings.txt`);
the export ships the artifacts rather than the dependency tree.

## Deployment path

The mainnet contracts were not deployed from Studio. The creation bytecode was taken from
the testnet deployment, its constructor arguments re-encoded to a locally held key, and
the result sent from an ordinary EOA — see `docs/verification.md` for the commands and
`DEPLOYMENTS.md` for the transactions.
