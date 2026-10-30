# Deployments

All addresses below are real deployments, not examples.

## Arc mainnet (chainId 5042)

| What | Value |
| --- | --- |
| ArconePayouts | `0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4` |
| ArconeInvoice | `0x1D0c34B719E3EE10d1904a80b66F69033E440984` |
| Owner and treasury | `0x865AcA7b2be3c3886d4c7bdDcf3Cd17dc1b2Db2A` |
| Withholding rate | 300 bps (3%) |
| USDC | `0x3600000000000000000000000000000000000000` |

ArconePayouts deploy: `0x7f27b08c3f8e6e4de1675e5b24bb93551140464f48a9dddd9d7e9d54000ae202`
(block 28,544,933), 629,485 gas, 0.0126 USDC.

First real payout: `0xa08d370e3d1285ae851a6df4e4bdda6db69941f2d54cf6ad13e0f5e0527d4657`
(block 28,545,028) — 0.10 USDC in, 0.003 withheld, 0.097 delivered, 0.0028 USDC of gas.

ArconeInvoice deploy: `0x6e0d3e7740107999ed3c2ea7c71a162eaa563aea6ecbed9406bf3aca0a49beba`
(block 28,568,790), 985,962 gas, 0.0203 USDC.

First invoice created and paid on mainnet: invoice 1 for 0.02 USDC,
created in `0x785db74ccb9d3a7674e01dc3596abe14e8d57b9b376f19033259fcb7ba269e04`
and paid in `0x279a2edcad68a3e072027e13e875280f5e115a85d048ca5766b3ab769ba729c1`,
status 0 to 1.

## Arc testnet (chainId 5042002)

| What | Value |
| --- | --- |
| ArconePayouts | `0x038d0d457abb5a26cc95c4ea067df48dca5a36c4` |
| ArconeInvoice | `0x5bdfa49f0ba18891c78881541ec34eb3988b9fb1` |
| Owner and treasury | `0x660945a13eE097674fEF9AEd50dA3Fa2C930BD65` |

Earlier testnet contracts, kept here so old links stay explainable:

- `0x31ccb0a6f30acb34a65b0e6df74c66be026ddf62` — first ArconePayouts. Its owner is
  `0xa3039a54856ed74b5aec999eef3fc954ab010cf6`, the Arc Studio platform deployer, which
  means `setTreasury`, `setWithholdingBps` and `transferOwnership` can never be called.
- `0x486bce2f393f46e2b422fa851ef0c7b5b3b6a083` — second ArconeInvoice. Replaced because
  `payInvoice` reverted once the due date passed and nothing could extend it.

## Why the mainnet contract was deployed by hand

Arc Studio deploys through an ERC-4337 EntryPoint, with a platform-managed smart account
as the sender, so a constructor that takes `msg.sender` as its owner hands ownership to
that account. The key cannot be exported and the tooling cannot send transactions from it
afterwards.

The mainnet deployment therefore skips Studio entirely: the creation bytecode was taken
from the testnet deploy transaction, its constructor arguments were re-encoded to a key
held locally, and the result was deployed from an ordinary EOA. The deployed runtime is
byte-identical to the testnet build, which `tools/verify-deployment.js` checks.
