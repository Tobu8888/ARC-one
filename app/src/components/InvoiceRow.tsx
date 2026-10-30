import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { Copy, Check, ExternalLink, X, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { usdcDecimalsFor, Amount } from '@/onchain-money'
import { ARCONE_INVOICE_ABI } from '@/contracts/ArconeInvoice'
import { buildTxExplorer, getChainConfig } from '@/chainConfig'
import type { InvoiceItem } from '@/hooks/useInvoiceList'

const PAGE_LOAD_SEC = BigInt(Math.floor(performance.timeOrigin / 1000))
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function fmtDate(ts: bigint) {
  if (ts === 0n) return null
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10)
}

function shareUrl(id: bigint) {
  return `${window.location.origin}/?invoice=${id}`
}

function StatusBadge({ status, dueDate }: { status: 0 | 1 | 2; dueDate: bigint }) {
  const isOverdue = status === 0 && dueDate > 0n && PAGE_LOAD_SEC > dueDate
  return (
    <div className="flex items-center gap-1.5">
      {isOverdue && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(245,200,66,0.15)', color: 'var(--wht-gold)', border: '1px solid rgba(245,200,66,0.3)' }}>
          Overdue
        </span>
      )}
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
        background: status === 1 ? 'rgba(52,199,89,0.15)' : status === 2 ? 'rgba(255,69,58,0.15)' : 'rgba(77,157,224,0.15)',
        color: status === 1 ? 'var(--success)' : status === 2 ? 'var(--danger)' : 'var(--accent)',
      }}>
        {status === 0 ? 'Pending' : status === 1 ? 'Paid' : 'Cancelled'}
      </span>
    </div>
  )
}

function CopyLinkButton({ id }: { id: bigint }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(shareUrl(id))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-all hover:opacity-80"
      style={{ background: 'var(--surface-muted)', color: copied ? 'var(--success)' : 'var(--accent)', border: '1px solid var(--border)' }}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}

interface Props {
  item: InvoiceItem
  chainId: number
  onRefresh: (id: bigint) => void
}

export default function InvoiceRow({ item, chainId, onRefresh }: Props) {
  const { address } = useAccount()
  const { id, data } = item
  const [expanded, setExpanded] = useState(false)

  const cfg = getChainConfig(chainId)
  const USDCDEC = usdcDecimalsFor(chainId)
  const fmtUsdc = (v: bigint) => Amount.fromRaw(v, USDCDEC).toFixed(2)

  const isPayee = address?.toLowerCase() === data.payee.toLowerCase()
  const isPending = data.status === 0
  const canCancel = isPayee && isPending

  const { writeContract, data: cancelHash, isPending: isCancelling } = useWriteContract()
  const { isLoading: isCancelWaiting, isSuccess: isCancelDone } = useWaitForTransactionReceipt({ hash: cancelHash })

  if (isCancelDone) onRefresh(id)

  const handleCancel = () => {
    writeContract({
      address: cfg.invoice,
      abi: ARCONE_INVOICE_ABI,
      functionName: 'cancelInvoice',
      args: [id],
      chainId,
    })
  }

  const dueStr = fmtDate(data.dueDate)
  const payerLabel = data.payer === ZERO_ADDR ? 'Open link' : `${data.payer.slice(0, 8)}…${data.payer.slice(-6)}`
  const isBusy = isCancelling || isCancelWaiting

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: 'var(--surface-strong)', border: `1px solid ${expanded ? 'var(--border-strong)' : 'var(--border)'}` }}>
      <button className="w-full px-4 py-3.5 flex items-center gap-3 hover:opacity-90 transition-opacity text-left" onClick={() => setExpanded(e => !e)}>
        <div className="size-9 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-bold"
          style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}>
          #{String(id)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{data.memo || '(no memo)'}</p>
          <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
            {payerLabel}{dueStr ? ` · due ${dueStr}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="mono text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{fmtUsdc(data.amount)} USDC</p>
          <StatusBadge status={data.status} dueDate={data.dueDate} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--surface-muted)' }}>
            <div className="flex items-center gap-1.5">
              <TokenUSDC variant="branded" size={16} />
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{fmtUsdc(data.amount)}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>USDC full settlement</span>
            </div>
            {data.paidAt > 0n && (
              <span className="text-xs" style={{ color: 'var(--success)' }}>Paid {fmtDate(data.paidAt)}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--subtle)' }}>Payer</p>
              <p className="mono text-xs truncate" style={{ color: 'var(--ink-2)' }}>{payerLabel}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--subtle)' }}>Due date</p>
              <p className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{dueStr ?? 'None'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CopyLinkButton id={id} />
            <a href={shareUrl(id)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              <ExternalLink className="size-3" />Preview
            </a>
            {cancelHash && !isCancelling && !isCancelWaiting && (
              <a href={buildTxExplorer(chainId, cancelHash)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:opacity-80"
                style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                <ExternalLink className="size-3" />Tx
              </a>
            )}
            {canCancel && (
              <button onClick={handleCancel} disabled={isBusy}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(255,69,58,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,69,58,0.25)' }}>
                {isBusy ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                {isBusy ? 'Cancelling…' : 'Cancel invoice'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
