/**
 * usePayoutHistory — loads PayoutSent history for a given chain.
 *
 * Testnet:  GET <explorerBase>/api/v2/addresses/<addr>/logs  (Blockscout, paginated)
 * Mainnet:  windowed getLogs from deployBlock to head, 10,000 blocks per window,
 *           100 ms delay between windows, session-cached, 60-window cap.
 *
 * Window boundary: fromBlock = start, toBlock = start + WINDOW - 1
 * so each window is exactly WINDOW blocks (never WINDOW + 1).
 */

import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem'
import { arcMainnetChain, arcTestnetChain, getChainConfig } from '@/chainConfig'
import { ARCONE_PAYOUTS_ABI } from '@/contracts/ArconePayouts'

const WINDOW = 10_000n          // blocks per getLogs call (inclusive boundary: [from, from+WINDOW-1])
const MAX_WINDOWS = 60          // cap to avoid unbounded scans
const INTER_WINDOW_MS = 100     // delay between windows

const PAYOUT_SENT_ABI = parseAbiItem(
  'event PayoutSent(uint256 indexed payoutId, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 withheldAmount, uint256 netAmount, uint16 withholdingBps, string memo, uint256 timestamp)'
)

export interface PayoutEvent {
  payoutId: bigint
  sender: string
  recipient: string
  grossAmount: bigint
  withheldAmount: bigint
  netAmount: bigint
  withholdingBps: number
  memo: string
  timestamp: bigint
  txHash: string
  logIndex: number
  blockNumber: bigint
}

type Status = 'idle' | 'loading' | 'done' | 'error'

// ── Session cache keyed by chainId ─────────────────────────────────────────
// Avoids re-scanning on tab focus / minor re-renders.
const rpcCache = new Map<number, PayoutEvent[]>()

// ── ABI decoding helpers ───────────────────────────────────────────────────

function decodeUint256(b: Uint8Array, offset: number): bigint {
  let v = 0n
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(b[offset + i])
  return v
}

function decodeString(b: Uint8Array, tailOffset: number): string {
  const strOffset = Number(decodeUint256(b, tailOffset))
  const length = Number(decodeUint256(b, strOffset))
  return new TextDecoder().decode(b.slice(strOffset + 32, strOffset + 32 + length))
}

interface ExplorerLogItem {
  block_number: number
  transaction_hash: string
  index: number
  topics: string[]
  data: string
  block_timestamp: string
}

function decodeExplorerLog(item: ExplorerLogItem): PayoutEvent | null {
  try {
    const topics = item.topics as [`0x${string}`, ...`0x${string}`[]]
    const decoded = decodeEventLog({
      abi: [PAYOUT_SENT_ABI],
      topics,
      data: item.data as `0x${string}`,
      eventName: 'PayoutSent',
    })
    const a = decoded.args as {
      payoutId: bigint; sender: string; recipient: string
      grossAmount: bigint; withheldAmount: bigint; netAmount: bigint
      withholdingBps: number; memo: string; timestamp: bigint
    }
    return {
      payoutId: a.payoutId, sender: a.sender, recipient: a.recipient,
      grossAmount: a.grossAmount, withheldAmount: a.withheldAmount, netAmount: a.netAmount,
      withholdingBps: a.withholdingBps, memo: a.memo, timestamp: a.timestamp,
      txHash: item.transaction_hash, logIndex: item.index,
      blockNumber: BigInt(item.block_number),
    }
  } catch {
    try {
      const topics = item.topics
      const payoutId = BigInt(topics[1])
      const sender = '0x' + topics[2].slice(26)
      const recipient = '0x' + topics[3].slice(26)
      const b = new Uint8Array(
        (item.data.slice(2).match(/.{2}/g) ?? []).map(h => parseInt(h, 16))
      )
      return {
        payoutId, sender, recipient,
        grossAmount: decodeUint256(b, 0), withheldAmount: decodeUint256(b, 32), netAmount: decodeUint256(b, 64),
        withholdingBps: Number(decodeUint256(b, 96)), memo: decodeString(b, 128), timestamp: decodeUint256(b, 160),
        txHash: item.transaction_hash, logIndex: item.index, blockNumber: BigInt(item.block_number),
      }
    } catch { return null }
  }
}

// ── Explorer fetch (testnet only, paginated) ───────────────────────────────

async function fetchFromExplorer(explorerBase: string, address: string): Promise<PayoutEvent[]> {
  const results: PayoutEvent[] = []
  let url: string | null = `${explorerBase}/api/v2/addresses/${address}/logs`
  while (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Explorer API ${res.status}`)
    const json = await res.json() as { items: ExplorerLogItem[]; next_page_params: Record<string, unknown> | null }
    for (const item of json.items) {
      const e = decodeExplorerLog(item)
      if (e) results.push(e)
    }
    if (json.next_page_params) {
      const params = new URLSearchParams(Object.entries(json.next_page_params).map(([k, v]) => [k, String(v)]))
      url = `${explorerBase}/api/v2/addresses/${address}/logs?${params}`
    } else { url = null }
  }
  return results
}

// ── Windowed RPC scan (mainnet) ────────────────────────────────────────────
// Each window covers [start, start + WINDOW - 1], exactly WINDOW blocks.
// Scans forward from deployBlock; stops at head or MAX_WINDOWS, whichever comes first.
// Returns { events, capped } where capped=true means the cap was hit before head.

async function fetchFromRpcWindowed(
  chainId: number,
  address: string,
  deployBlock: bigint,
): Promise<{ events: PayoutEvent[]; capped: boolean }> {
  const chain = chainId === 5042 ? arcMainnetChain : arcTestnetChain
  const rpc = getChainConfig(chainId).rpc
  const client = createPublicClient({ chain, transport: http(rpc) })
  const head = await client.getBlockNumber()

  const results: PayoutEvent[] = []
  let windowStart = deployBlock
  let windowCount = 0
  let capped = false

  while (windowStart <= head) {
    if (windowCount >= MAX_WINDOWS) { capped = true; break }

    // Inclusive window: [windowStart, windowStart + WINDOW - 1], clamped to head
    const windowEnd = windowStart + WINDOW - 1n < head ? windowStart + WINDOW - 1n : head

    const logs = await client.getLogs({
      address: address as `0x${string}`,
      event: PAYOUT_SENT_ABI,
      fromBlock: windowStart,
      toBlock: windowEnd,
    })

    for (const log of logs) {
      const a = log.args as {
        payoutId: bigint; sender: string; recipient: string
        grossAmount: bigint; withheldAmount: bigint; netAmount: bigint
        withholdingBps: number; memo: string; timestamp: bigint
      }
      if (!a) continue
      results.push({
        payoutId: a.payoutId, sender: a.sender, recipient: a.recipient,
        grossAmount: a.grossAmount, withheldAmount: a.withheldAmount, netAmount: a.netAmount,
        withholdingBps: a.withholdingBps, memo: a.memo, timestamp: a.timestamp,
        txHash: log.transactionHash ?? '', logIndex: log.logIndex ?? 0, blockNumber: log.blockNumber ?? 0n,
      })
    }

    windowStart = windowEnd + 1n
    windowCount++

    if (windowStart <= head) {
      await new Promise(r => setTimeout(r, INTER_WINDOW_MS))
    }
  }

  return { events: results, capped }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePayoutHistory(chainId: number, realtimeEvents: PayoutEvent[]) {
  const [events, setEvents] = useState<PayoutEvent[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [isFallback, setIsFallback] = useState(false)
  const [isCapped, setIsCapped] = useState(false)
  const loadedChainRef = useRef<number | null>(null)

  useEffect(() => {
    if (loadedChainRef.current === chainId) return
    loadedChainRef.current = chainId
    setEvents([])
    setStatus('loading')
    setIsFallback(false)
    setIsCapped(false)

    const cfg = getChainConfig(chainId)
    const address = cfg.payouts

    void (async () => {
      // Testnet: Blockscout explorer API (full history, no block scan)
      if (cfg.explorerSupportsLogs) {
        try {
          const hist = await fetchFromExplorer(cfg.explorerBase, address)
          hist.sort((a, b) => a.blockNumber !== b.blockNumber ? Number(b.blockNumber - a.blockNumber) : b.logIndex - a.logIndex)
          setEvents(hist)
          setStatus('done')
          return
        } catch (explorerErr) {
          console.warn('[ARCone] Explorer API failed, falling back to RPC getLogs', explorerErr)
        }
      }

      // Mainnet (or testnet explorer fallback): windowed RPC scan
      // Check session cache first
      const cached = rpcCache.get(chainId)
      if (cached) {
        setEvents(cached)
        setIsFallback(true)
        setStatus('done')
        return
      }

      try {
        const { events: hist, capped } = await fetchFromRpcWindowed(chainId, address, cfg.payoutsDeployBlock)
        hist.sort((a, b) => a.blockNumber !== b.blockNumber ? Number(b.blockNumber - a.blockNumber) : b.logIndex - a.logIndex)
        rpcCache.set(chainId, hist)
        setEvents(hist)
        setIsFallback(!cfg.explorerSupportsLogs)
        setIsCapped(capped)
        setStatus('done')
      } catch (rpcErr) {
        console.error('[ARCone] RPC windowed scan failed', rpcErr)
        setStatus('error')
      }
    })()
  }, [chainId])

  // Merge realtime + historical, de-dup by txHash:logIndex
  const merged: PayoutEvent[] = [...realtimeEvents]
  const seen = new Set(realtimeEvents.map(e => `${e.txHash}:${e.logIndex}`))
  for (const e of events) {
    const key = `${e.txHash}:${e.logIndex}`
    if (!seen.has(key)) { seen.add(key); merged.push(e) }
  }
  merged.sort((a, b) => a.blockNumber !== b.blockNumber ? Number(b.blockNumber - a.blockNumber) : b.logIndex - a.logIndex)

  return { events: merged, status, isFallback, isCapped }
}

// Kept for backward compat with any direct import
export { ARCONE_PAYOUTS_ABI }
