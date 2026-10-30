/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet, arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { ARCONE_CHAINS } from './chainConfig'

const testnetCfg = ARCONE_CHAINS[5042002]
const mainnetCfg = ARCONE_CHAINS[5042]

// Arc Mainnet chain definition (not yet in viem/chains)
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [mainnetCfg.rpc] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: mainnetCfg.explorerBase } },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, testnetCfg.rpc)
registerChain(arcMainnet.id, mainnetCfg.rpc)

export const config = createConfig({
  chains: [arcMainnet, arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    5042: http(mainnetCfg.rpc),
    5042002: http(testnetCfg.rpc),
    1: http(), // ENS resolution uses mainnet
  },
})

// Re-export for any legacy imports
export const ARC_TESTNET_RPC = testnetCfg.rpc
