/**
 * Per-chain configuration for ARCone.
 * One canonical place for chain id, RPC, explorer base,
 * USDC address, and contract addresses.
 * Nothing in a component may hardcode any of these values.
 */
import { defineChain } from 'viem'
import { arcTestnet } from 'viem/chains'

// Arc Mainnet viem chain definition.
// Exported here (not from config.ts) to avoid circular deps from hooks.
export const arcMainnetChain = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
})

export { arcTestnet as arcTestnetChain }

export interface ArconeChainConfig {
  chainId: number
  name: string              // display name
  rpc: string
  explorerBase: string      // e.g. https://explorer.arc.io  (no trailing slash)
  explorerSupportsLogs: boolean   // false = mainnet (Cloudflare 403), use RPC fallback
  usdc: `0x${string}`
  payouts: `0x${string}`
  payoutsDeployBlock: bigint      // first block to scan from for PayoutSent
  invoice: `0x${string}`
  invoiceDeployBlock: bigint      // first block to scan from for InvoiceCreated
  isTestnet: boolean
}

export const ARCONE_CHAINS: Record<number, ArconeChainConfig> = {
  // Arc Testnet
  5042002: {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpc: 'https://rpc.testnet.arc.io',
    explorerBase: 'https://explorer.testnet.arc.io',
    explorerSupportsLogs: true,
    usdc: '0x3600000000000000000000000000000000000000',
    payouts: '0x038d0d457abb5a26cc95c4ea067df48dca5a36c4',
    payoutsDeployBlock: 0n, // testnet uses explorer API, not block scan
    invoice: '0x5bdfa49f0ba18891c78881541ec34eb3988b9fb1',
    invoiceDeployBlock: 0n, // testnet uses explorer API, not block scan
    isTestnet: true,
  },
  // Arc Mainnet
  5042: {
    chainId: 5042,
    name: 'Arc',
    rpc: 'https://rpc.mainnet.arc.io',
    explorerBase: 'https://explorer.arc.io',
    explorerSupportsLogs: false, // Cloudflare 403 on mainnet explorer API
    usdc: '0x3600000000000000000000000000000000000000',
    payouts: '0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4',
    payoutsDeployBlock: 28544933n,
    invoice: '0x1D0c34B719E3EE10d1904a80b66F69033E440984',
    invoiceDeployBlock: 28568790n,
    isTestnet: false,
  },
}

export const DEFAULT_CHAIN_ID = 5042 // Arc Mainnet default

export function getChainConfig(chainId: number): ArconeChainConfig {
  const cfg = ARCONE_CHAINS[chainId]
  if (!cfg) throw new Error(`ARCone: unsupported chain ${chainId}`)
  return cfg
}

export function buildTxExplorer(chainId: number, txHash: string): string {
  return `${getChainConfig(chainId).explorerBase}/tx/${txHash}`
}

export function buildAddressExplorer(chainId: number, address: string): string {
  return `${getChainConfig(chainId).explorerBase}/address/${address}`
}
