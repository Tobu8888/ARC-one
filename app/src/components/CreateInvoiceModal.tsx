import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { decodeEventLog } from 'viem'
import { X, FileText, CheckCircle2, Loader2, Copy, Check, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { parseUsdc } from '@/onchain-money'
import { ARCONE_INVOICE_ABI } from '@/contracts/ArconeInvoice'
import { getChainConfig, buildTxExplorer } from '@/chainConfig'

const TODAY_LOCAL = new Date(performance.timeOrigin).toLocaleDateString('en-CA')

interface Props {
  chainId: number
  onClose: () => void
  onCreated: (invoiceId: bigint) => void
}

type Step = 'form' | 'confirm' | 'pending' | 'done'

export default function CreateInvoiceModal({ chainId, onClose, onCreated }: Props) {
  const { address, isConnected } = useAccount()
  const cfg = getChainConfig(chainId)
  const [step, setStep] = useState<Step>('form')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [payerAddr, setPayerAddr] = useState('')
  const [dueDateStr, setDueDateStr] = useState('')
  const [createdId, setCreatedId] = useState<bigint | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { writeContractAsync } = useWriteContract()
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    chainId,
  })

  const extractId = (r: typeof receipt): bigint | null => {
    if (!r) return null
    for (const log of r.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ARCONE_INVOICE_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'InvoiceCreated',
        })
        return (decoded.args as unknown as Record<string, unknown>).id as bigint
      } catch { /* skip */ }
    }
    return null
  }

  if (receipt && step === 'pending') {
    const id = extractId(receipt)
    if (id !== null) {
      setCreatedId(id)
      setStep('done')
      onCreated(id)
    }
  }

  const handleCreate = async () => {
    setError(null)
    if (!isConnected || !address) { setError('Connect wallet first'); return }
    let grossBn: bigint
    try { grossBn = parseUsdc(amountStr) } catch { setError('Invalid amount'); return }
    if (grossBn <= 0n) { setError('Amount must be > 0'); return }
    if (!memo.trim()) { setError('Memo is required'); return }

    const payer = (payerAddr.trim() as `0x${string}`) || '0x0000000000000000000000000000000000000000'
    const dueDate = dueDateStr
      ? (() => {
          const [y, m, d] = dueDateStr.split('-').map(Number)
          const local = new Date(y, m - 1, d, 23, 59, 59)
          return BigInt(Math.floor(local.getTime() / 1000))
        })()
      : 0n

    setStep('confirm')
    try {
      const hash = await writeContractAsync({
        address: cfg.invoice,
        abi: ARCONE_INVOICE_ABI,
        functionName: 'createInvoice',
        args: [payer, grossBn, memo.trim(), dueDate],
        chainId,
      })
      setTxHash(hash)
      setStep('pending')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Transaction failed')
      setStep('form')
    }
  }

  const invoiceUrl = createdId !== null
    ? `${window.location.origin}/?invoice=${createdId.toString()}`
    : ''

  const copyLink = () => {
    void navigator.clipboard.writeText(invoiceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const grossNum = (() => { try { return parseFloat(amountStr) || 0 } catch { return 0 } })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(7,16,30,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={step === 'form' ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: '#0d1b2f', border: '1px solid var(--border-strong)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-0.5" style={{ background: 'var(--accent)' }} />
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(77,157,224,0.15)' }}>
              <FileText className="size-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Create Invoice</p>
              <p className="text-[10px]" style={{ color: 'var(--subtle)' }}>{cfg.name} · USDC-native</p>
            </div>
          </div>
          {step !== 'pending' && (
            <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" style={{ background: 'var(--surface-strong)', color: 'var(--ink)' }}>
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="px-5 pb-5 space-y-3">
          {step === 'form' && (
            <>
              <div className="rounded-2xl p-4 space-y-1" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Invoice Amount</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="flex-1 bg-transparent text-2xl font-bold outline-none tabular-nums"
                    style={{ color: 'var(--ink)' }} />
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <TokenUSDC variant="branded" size={16} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>USDC</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-4 space-y-1" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Description / Memo</p>
                <input type="text" placeholder="e.g. Design fee - Oct 2026" value={memo}
                  onChange={e => setMemo(e.target.value)} maxLength={120}
                  className="w-full bg-transparent text-sm outline-none" style={{ color: 'var(--ink)' }} />
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Optional</p>
                <div className="space-y-1">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Lock to payer address (leave blank = anyone can pay)</p>
                  <input type="text" placeholder="0x..." value={payerAddr}
                    onChange={e => setPayerAddr(e.target.value)}
                    className="w-full bg-transparent text-xs mono outline-none" style={{ color: 'var(--ink)' }} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Due date</p>
                  <input type="date" min={TODAY_LOCAL} value={dueDateStr}
                    onChange={e => setDueDateStr(e.target.value)}
                    className="bg-transparent text-xs outline-none"
                    style={{ color: 'var(--ink)', colorScheme: 'dark' }} />
                </div>
              </div>

              {error && <p className="text-xs px-1" style={{ color: 'var(--danger)' }}>{error}</p>}

              <button onClick={() => { void handleCreate() }}
                disabled={!amountStr || !memo.trim() || grossNum <= 0}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                <FileText className="size-4" />Create Invoice
              </button>
            </>
          )}

          {(step === 'confirm' || step === 'pending') && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {step === 'confirm' ? 'Confirm in wallet…' : 'Creating invoice on-chain…'}
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>Arc · sub-second finality</p>
            </div>
          )}

          {step === 'done' && createdId !== null && (
            <>
              <div className="py-4 flex flex-col items-center gap-2">
                <CheckCircle2 className="size-10" style={{ color: 'var(--success)' }} />
                <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>Invoice #{createdId.toString()} created</p>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>{grossNum.toFixed(2)} USDC · {memo}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Share payment link</p>
                <div className="flex items-center gap-2">
                  <p className="mono text-xs flex-1 truncate" style={{ color: 'var(--accent)' }}>{invoiceUrl}</p>
                  <button onClick={copyLink} className="shrink-0 size-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80" style={{ background: 'rgba(77,157,224,0.15)' }}>
                    {copied ? <Check className="size-3.5" style={{ color: 'var(--success)' }} /> : <Copy className="size-3.5" style={{ color: 'var(--accent)' }} />}
                  </button>
                </div>
              </div>

              {txHash && (
                <a href={buildTxExplorer(chainId, txHash)} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs hover:underline"
                  style={{ color: 'var(--accent)' }}>
                  View on explorer <ExternalLink className="size-3" />
                </a>
              )}

              <button onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
