import { useState, useCallback, useRef, useEffect } from 'react'
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult, parseAbiItem } from 'viem'
import { arcMainnetChain, arcTestnetChain } from '@/chainConfig'
import { ARCONE_INVOICE_ABI } from '@/contracts/ArconeInvoice'
import type { InvoiceData } from '@/contracts/ArconeInvoice'
import { getChainConfig } from '@/chainConfig'

const INVOICE_CREATED_ABI = parseAbiItem(
  'event InvoiceCreated(uint256 indexed id, address indexed payee, address indexed payer, uint256 amount, string memo, uint256 dueDate)'
)

const WINDOW = 10_000n        // blocks per getLogs call — [from, from+WINDOW-1] = exactly WINDOW blocks
const MAX_WINDOWS = 60        // cap to avoid unbounded scans
const INTER_WINDOW_MS = 100   // delay between windows (ms)

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

const MULTICALL3_ABI = [
  {
    name: 'aggregate3',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' }] }],
    outputs: [{ name: 'returnData', type: 'tuple[]', components: [{ name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }] }],
  },
] as const

function makeClient(chainId: number) {
  const cfg = getChainConfig(chainId)
  const chain = chainId === 5042 ? arcMainnetChain : arcTestnetChain
  return createPublicClient({ chain, transport: http(cfg.rpc) })
}

// ---- RPC windowed scan: fetch InvoiceCreated ids for a payee ----
// payee is indexed topic[2] — getLogs filters by it precisely.
// Each window is [start, start+WINDOW-1] = exactly WINDOW blocks.
// Scans forward from deployBlock; stops at head or MAX_WINDOWS.
async function fetchInvoiceIdsRpc(
  chainId: number,
  contract: string,
  payee: string,
  deployBlock: bigint,
): Promise<{ ids: bigint[]; capped: boolean }> {
  const client = makeClient(chainId)
  const head = await client.getBlockNumber()
  const ids: bigint[] = []
  let windowStart = deployBlock
  let windowCount = 0
  let capped = false

  while (windowStart <= head) {
    if (windowCount >= MAX_WINDOWS) { capped = true; break }

    const windowEnd = windowStart + WINDOW - 1n < head ? windowStart + WINDOW - 1n : head

    const logs = await client.getLogs({
      address: contract as `0x${string}`,
      event: INVOICE_CREATED_ABI,
      args: { payee: payee as `0x${string}` },
      fromBlock: windowStart,
      toBlock: windowEnd,
    })
    for (const log of logs) {
      const id = (log.args as { id?: bigint }).id
      if (id !== undefined && !ids.includes(id)) ids.push(id)
    }

    windowStart = windowEnd + 1n
    windowCount++
    if (windowStart <= head) {
      await new Promise(r => setTimeout(r, INTER_WINDOW_MS))
    }
  }

  return { ids, capped }
}

// ---- Explorer: fetch InvoiceCreated ids for a payee ----
async function fetchInvoiceIds(explorerBase: string, contract: string, payee: string): Promise<bigint[]> {
  const ids: bigint[] = []
  const payeeNorm = payee.toLowerCase()
  let nextPage: string | null = null
  while (true) {
    const url = `${explorerBase}/api/v2/addresses/${contract}/logs${nextPage ? '?' + nextPage : ''}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Explorer API ${res.status}: ${url}`)
    const json = await res.json() as {
      items: Array<{ topics: string[] }>
      next_page_params: Record<string, string> | null
    }
    for (const item of json.items) {
      if (!item.topics || item.topics.length < 3) continue
      const payeeTopic = item.topics[2]
      if (!payeeTopic) continue
      if (('0x' + payeeTopic.slice(26)).toLowerCase() !== payeeNorm) continue
      const idHex = item.topics[1]
      if (!idHex) continue
      const id = BigInt(idHex)
      if (!ids.includes(id)) ids.push(id)
    }
    if (!json.next_page_params) break
    nextPage = new URLSearchParams(
      Object.entries(json.next_page_params).map(([k, v]) => [k, String(v)])
    ).toString()
  }
  return ids
}

// ---- Multicall3: read all invoices in ONE RPC call ----
async function fetchAllInvoiceData(chainId: number, contract: string, ids: bigint[]): Promise<InvoiceData[]> {
  if (ids.length === 0) return []
  const client = makeClient(chainId)

  const calls = ids.map(id => ({
    target: contract as `0x${string}`,
    allowFailure: true,
    callData: encodeFunctionData({ abi: ARCONE_INVOICE_ABI, functionName: 'getInvoice', args: [id] }),
  }))

  const results = await client.readContract({
    address: MULTICALL3,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [calls],
  }) as Array<{ success: boolean; returnData: `0x${string}` }>

  const out: InvoiceData[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const id = ids[i]
    if (!r.success) { console.error(`[ARCone] getInvoice(${id}) failed in multicall — skipping`); continue }
    try {
      const raw = decodeFunctionResult({ abi: ARCONE_INVOICE_ABI, functionName: 'getInvoice', data: r.returnData }) as {
        id: bigint; payee: string; payer: string; amount: bigint
        memo: string; dueDate: bigint; status: number; paidAt: bigint
      }
      if (!raw.payee) { console.error(`[ARCone] getInvoice(${id}) returned no payee — skipping`); continue }
      out.push({ id: raw.id, payee: raw.payee, payer: raw.payer, amount: raw.amount, memo: raw.memo, dueDate: raw.dueDate, status: raw.status as 0 | 1 | 2, paidAt: raw.paidAt })
    } catch (e) { console.error(`[ARCone] getInvoice(${id}) decode failed`, e) }
  }
  return out
}

// ---- Single-item read (for prepend / refreshOne) ----
async function fetchInvoiceData(chainId: number, contract: string, id: bigint): Promise<InvoiceData> {
  const client = makeClient(chainId)
  const r = await client.readContract({
    address: contract as `0x${string}`, abi: ARCONE_INVOICE_ABI, functionName: 'getInvoice', args: [id],
  }) as { id: bigint; payee: string; payer: string; amount: bigint; memo: string; dueDate: bigint; status: number; paidAt: bigint }
  return { id: r.id, payee: r.payee, payer: r.payer, amount: r.amount, memo: r.memo, dueDate: r.dueDate, status: r.status as 0 | 1 | 2, paidAt: r.paidAt }
}

// ---- Async runner ----
function useAsyncRunner() {
  const [trigger, setTrigger] = useState(0)
  const taskRef = useRef<(() => Promise<void>) | null>(null)
  const run = useCallback((task: () => Promise<void>) => {
    taskRef.current = task
    setTrigger(t => t + 1)
  }, [])
  return { trigger, taskRef, run }
}

export type InvoiceListStatus = 'idle' | 'loading' | 'done' | 'error'
export interface InvoiceItem { id: bigint; data: InvoiceData }

async function loadInvoices(
  chainId: number,
  payee: string,
  setItems: (v: InvoiceItem[]) => void,
  setStatus: (v: InvoiceListStatus) => void,
  setError: (v: string | null) => void,
  setIsCapped: (v: boolean) => void,
) {
  setStatus('loading')
  setError(null)
  setIsCapped(false)
  const cfg = getChainConfig(chainId)

  // Step 1: get invoice IDs
  let ids: bigint[]
  if (cfg.explorerSupportsLogs) {
    // Testnet: Blockscout explorer API (full history)
    try {
      ids = await fetchInvoiceIds(cfg.explorerBase, cfg.invoice, payee)
    } catch (e) {
      console.error('[ARCone] Explorer API failed', e)
      setError('Could not load invoice list from explorer')
      setStatus('error')
      return
    }
  } else {
    // Mainnet: windowed getLogs from deployBlock, payee topic filter
    try {
      const result = await fetchInvoiceIdsRpc(chainId, cfg.invoice, payee, cfg.invoiceDeployBlock)
      ids = result.ids
      setIsCapped(result.capped)
    } catch (e) {
      console.error('[ARCone] RPC getLogs scan failed', e)
      setError('Could not load invoice list from chain')
      setStatus('error')
      return
    }
  }

  if (ids.length === 0) { setItems([]); setStatus('done'); return }

  // Step 2: multicall3 batch read
  let datas: InvoiceData[]
  try {
    datas = await fetchAllInvoiceData(chainId, cfg.invoice, ids)
  } catch (e) {
    console.error('[ARCone] Multicall3 batch read failed', e)
    setError('Could not read invoice data from chain (multicall3)')
    setStatus('error')
    return
  }

  try {
    const mine = datas
      .filter(d => {
        if (!d.payee) { console.error('[ARCone] invoice row missing payee — skipping'); return false }
        return d.payee.toLowerCase() === payee.toLowerCase()
      })
      .map(d => ({ id: d.id, data: d }))
      .sort((a, b) => (a.id > b.id ? -1 : 1))
    setItems(mine)
    setStatus('done')
  } catch (e) {
    console.error('[ARCone] invoice list processing failed', e)
    setError('Failed to process invoice list')
    setStatus('error')
  }
}

export function useInvoiceList(chainId: number, payee: string | undefined) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [status, setStatus] = useState<InvoiceListStatus>('idle')
  const [errorMsg, setError] = useState<string | null>(null)
  const [isCapped, setIsCapped] = useState(false)
  const { trigger, taskRef, run } = useAsyncRunner()

  const loadKey = `${chainId}:${payee ?? ''}`
  const prevKeyRef = useRef('')

  if (prevKeyRef.current !== loadKey) {
    prevKeyRef.current = loadKey
    if (!payee) {
      run(() => Promise.resolve().then(() => { setItems([]); setStatus('idle'); setError(null); setIsCapped(false) }))
    } else {
      const p = payee
      run(() => loadInvoices(chainId, p, setItems, setStatus, setError, setIsCapped))
    }
  }

  useEffect(() => {
    const task = taskRef.current
    if (task) { taskRef.current = null; void task() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const refresh = useCallback(() => {
    if (!payee) return
    const p = payee
    run(() => loadInvoices(chainId, p, setItems, setStatus, setError, setIsCapped))
  }, [chainId, payee, run])

  const refreshOne = useCallback(async (id: bigint) => {
    const cfg = getChainConfig(chainId)
    try {
      const d = await fetchInvoiceData(chainId, cfg.invoice, id)
      setItems(prev => prev.map(item => item.id === id ? { id, data: d } : item))
    } catch (e) { console.error('[ARCone] refreshOne failed', e) }
  }, [chainId])

  const prepend = useCallback(async (id: bigint) => {
    const cfg = getChainConfig(chainId)
    try {
      const d = await fetchInvoiceData(chainId, cfg.invoice, id)
      setItems(prev => prev.some(item => item.id === id) ? prev : [{ id, data: d }, ...prev])
    } catch (e) { console.error('[ARCone] prepend failed', e) }
  }, [chainId])

  return { items, status, errorMsg, isCapped, refresh, refreshOne, prepend }
}
