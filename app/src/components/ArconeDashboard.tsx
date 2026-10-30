import { useState } from 'react'
import { useAccount, useReadContract, useWatchContractEvent, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import {
  ExternalLink, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Copy, Check, Globe, FileText, Loader2, AlertCircle, Plus,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import ArconeLockup, { ArconeModalIcon } from '@/components/ArconeLockup'
import SendPayoutModal from '@/components/SendPayoutModal'
import CreateInvoiceModal from '@/components/CreateInvoiceModal'
import InvoiceRow from '@/components/InvoiceRow'
import { ARCONE_PAYOUTS_ABI } from '@/contracts/ArconePayouts'
import { usePayoutHistory, type PayoutEvent } from '@/hooks/usePayoutHistory'
import { useInvoiceList } from '@/hooks/useInvoiceList'
import { ARCONE_CHAINS, DEFAULT_CHAIN_ID, getChainConfig, buildTxExplorer } from '@/chainConfig'

function fmtUsdc(chainId: number, v: bigint) {
  const n = Number(v) / 10 ** usdcDecimalsFor(chainId)
  if (n === 0) return '0.00'
  if (Math.abs(n) >= 0.01) return n.toFixed(2)
  // Non-zero but less than 0.01 — show up to 6 sig decimals, trim trailing zeros
  return parseFloat(n.toFixed(6)).toString()
}

function fmtDate(timestamp: bigint) {
  if (timestamp === 0n) return ''
  const d = new Date(Number(timestamp) * 1000)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function shortHash(h: string) { return h.slice(0, 6) + '…' + h.slice(-4) }

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <button onClick={copy} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
      {copied ? <Check className="size-3" style={{ color: 'var(--success)' }} /> : <Copy className="size-3" />}
    </button>
  )
}

function NetworkSwitcher({ chainId, onChange }: { chainId: number; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const { switchChain } = useSwitchChain()
  const chains = Object.values(ARCONE_CHAINS)
  const current = getChainConfig(chainId)

  const handleSelect = (id: number) => {
    setOpen(false)
    onChange(id)
    try { switchChain({ chainId: id }) } catch { /* wallet may not support programmatic switch */ }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all hover:opacity-80"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
      >
        <Globe className="size-3" />
        {current.name} · USDC-native
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 rounded-2xl overflow-hidden shadow-xl" style={{ background: '#0d1b2f', border: '1px solid var(--border-strong)' }}>
          {chains.map(c => (
            <button
              key={c.chainId}
              onClick={() => handleSelect(c.chainId)}
              className="w-full px-4 py-2.5 text-left text-xs flex items-center justify-between hover:opacity-80 transition-opacity"
              style={{ color: c.chainId === chainId ? 'var(--accent)' : 'var(--ink-2)' }}
            >
              <span>{c.name}</span>
              {c.isTestnet && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(77,157,224,0.12)', color: 'var(--accent)' }}>Testnet</span>}
              {c.chainId === chainId && <Check className="size-3 ml-1" style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TerminalCard({ ev, chainId }: { ev: PayoutEvent; chainId: number }) {
  const explorerUrl = buildTxExplorer(chainId, ev.txHash)
  const cfg = getChainConfig(chainId)
  const fmt = (v: bigint) => fmtUsdc(chainId, v)
  const pct = (ev.withholdingBps / 100).toFixed(0)
  return (
    <div className="rounded-2xl p-4 font-mono text-xs leading-relaxed" style={{ background: 'var(--surface-terminal)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
      <div className="mb-2">
        <span style={{ color: 'var(--terminal-muted)' }}>$ </span>
        <span style={{ color: 'var(--ink-2)' }}>arcpay pay</span>
        <span style={{ color: 'var(--terminal-muted)' }}> --to </span>
        <span style={{ color: 'var(--terminal-blue)' }}>{ev.recipient.slice(0, 8)}…{ev.recipient.slice(-6)}</span>
        <span style={{ color: 'var(--terminal-muted)' }}> --amount </span>
        <span style={{ color: 'var(--ink-2)' }}>{fmt(ev.grossAmount)}</span>
        <span style={{ color: 'var(--terminal-muted)' }}> --memo </span>
        <span style={{ color: 'var(--ink-2)' }}>"{ev.memo}"</span>
      </div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span style={{ color: 'var(--terminal-muted)' }}>↳ signing locally</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(77,157,224,0.15)', color: 'var(--accent)' }}>NON-CUSTODIAL</span>
      </div>
      <div className="mb-0.5" style={{ color: 'var(--terminal-muted)' }}>&nbsp;&nbsp;key never leaves your device — only the signed tx is sent</div>
      <div className="mb-0.5 flex items-center gap-1.5"><span style={{ color: 'var(--terminal-muted)' }}>↳ broadcasting… to Arc</span></div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <CheckCircle2 className="size-3 shrink-0" style={{ color: 'var(--terminal-green)' }} />
        <span style={{ color: 'var(--terminal-green)' }}>confirmed on-chain</span>
        <span style={{ color: 'var(--terminal-muted)' }}>· block {ev.blockNumber.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <span style={{ color: 'var(--terminal-muted)' }}>tx&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        <span style={{ color: 'var(--terminal-blue)' }}>{shortHash(ev.txHash)}</span>
        <CopyButton value={ev.txHash} />
      </div>
      <div className="flex items-center gap-1">
        <span style={{ color: 'var(--terminal-muted)' }}>explorer</span>
        <a href={explorerUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-0.5" style={{ color: 'var(--terminal-blue)' }}>
          {cfg.explorerBase.replace('https://', '')}/tx/{shortHash(ev.txHash)}
          <ExternalLink className="size-2.5" />
        </a>
      </div>
      <div style={{ color: 'var(--terminal-muted)' }} className="mt-0.5">
        wht&nbsp;&nbsp;&nbsp;&nbsp;{pct}% · {fmt(ev.withheldAmount)} USDC withheld · {fmt(ev.netAmount)} USDC net
      </div>
    </div>
  )
}

function BreakdownCard({ ev, chainId }: { ev: PayoutEvent; chainId: number }) {
  const fmt = (v: bigint) => fmtUsdc(chainId, v)
  const pct = (ev.withholdingBps / 100).toFixed(0)
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--subtle)' }}>Payout Breakdown</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Gross</span>
          <span className="mono text-sm font-semibold tabular-nums flex items-center gap-1" style={{ color: 'var(--ink)' }}>{fmt(ev.grossAmount)} <TokenUSDC variant="mono" size={14} /></span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Withholding <span style={{ color: 'var(--subtle)' }}>{pct}%</span></span>
          <span className="mono text-sm font-semibold tabular-nums flex items-center gap-1" style={{ color: 'var(--danger)' }}>-{fmt(ev.withheldAmount)} <TokenUSDC variant="mono" size={14} /></span>
        </div>
        <div className="h-px" style={{ background: 'var(--border)' }} />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Net to payee</span>
          <span className="display text-xl font-bold tabular-nums flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>{fmt(ev.netAmount)} <TokenUSDC variant="branded" size={18} /></span>
        </div>
      </div>
    </div>
  )
}

function ReceiptCard({ ev }: { ev: PayoutEvent }) {
  const pct = (ev.withholdingBps / 100).toFixed(0)
  const receiptId = `WHT-${ev.txHash.slice(2, 10).toUpperCase()}`
  const tags = ['PND.53-ready', `${pct}% withheld`, 'on-chain proof']
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(77,157,224,0.15)' }}>
            <FileText className="size-4" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Withholding receipt</span>
        </div>
        <div className="size-6 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
          <Check className="size-3.5" style={{ color: 'var(--accent-cta-text)' }} />
        </div>
      </div>
      <p className="mono text-xs font-semibold mb-3" style={{ color: 'var(--accent)' }}>{receiptId}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tags.map(tag => (
          <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{
            background: tag === 'PND.53-ready' ? 'rgba(245,200,66,0.12)' : 'rgba(77,157,224,0.12)',
            color: tag === 'PND.53-ready' ? 'var(--wht-gold)' : 'var(--accent)',
            border: `1px solid ${tag === 'PND.53-ready' ? 'rgba(245,200,66,0.25)' : 'rgba(77,157,224,0.2)'}`,
          }}>{tag}</span>
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--subtle)' }}>Non-custodial — you hold the keys.</p>
    </div>
  )
}

function TxDetailPanel({ ev, onClose, chainId }: { ev: PayoutEvent; onClose: () => void; chainId: number }) {
  const cfg = getChainConfig(chainId)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{ background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: '#0d1b2f', border: '1px solid var(--border-strong)' }} onClick={e => e.stopPropagation()}>
        <div className="h-0.5" style={{ background: 'var(--accent)' }} />
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <ArconeModalIcon size={18} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>arcpay · ARCone</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(77,157,224,0.12)', color: 'var(--accent)', border: '1px solid rgba(77,157,224,0.2)' }}>{cfg.name} · USDC-native</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{ev.memo}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" style={{ background: 'var(--surface-strong)', color: 'var(--ink)' }}>✕</button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <TerminalCard ev={ev} chainId={chainId} />
          <BreakdownCard ev={ev} chainId={chainId} />
          <ReceiptCard ev={ev} />
        </div>
      </div>
    </div>
  )
}

function PayoutRow({ ev, expanded, onToggle, onExpand, chainId }: { ev: PayoutEvent; expanded: boolean; onToggle: () => void; onExpand: () => void; chainId: number }) {
  const fmt = (v: bigint) => fmtUsdc(chainId, v)
  const date = fmtDate(ev.timestamp)
  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: 'var(--surface-strong)', border: `1px solid ${expanded ? 'var(--border-strong)' : 'var(--border)'}` }}>
      <button className="w-full px-4 py-3.5 flex items-center gap-3 hover:opacity-90 transition-opacity text-left" onClick={onToggle}>
        <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-muted)' }}>
          <Globe className="size-4" style={{ color: 'var(--subtle)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{ev.recipient.slice(0, 8)}…{ev.recipient.slice(-6)}</p>
          <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{ev.memo}{date ? ` · ${date}` : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="mono text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{fmt(ev.netAmount)} USDC</p>
          <p className="text-[10px] tabular-nums" style={{ color: 'var(--subtle)' }}>-{fmt(ev.withheldAmount)} WHT</p>
        </div>
        <div className="shrink-0 ml-1">
          {expanded ? <ChevronUp className="size-4" style={{ color: 'var(--subtle)' }} /> : <ChevronDown className="size-4" style={{ color: 'var(--subtle)' }} />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="pt-3"><TerminalCard ev={ev} chainId={chainId} /></div>
          <BreakdownCard ev={ev} chainId={chainId} />
          <ReceiptCard ev={ev} />
          <button onClick={onExpand} className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-80" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(77,157,224,0.2)' }}>
            <ExternalLink className="size-3" />Open full view
          </button>
        </div>
      )}
    </div>
  )
}

function WrongChainBanner({ walletChainId, selectedChainId }: { walletChainId: number; selectedChainId: number }) {
  const { switchChain } = useSwitchChain()
  const selected = getChainConfig(selectedChainId)
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(245,200,66,0.07)', border: '1px solid rgba(245,200,66,0.25)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--wht-gold)' }} />
        <p className="text-xs" style={{ color: 'var(--wht-gold)' }}>
          Wallet is on chain {walletChainId} — switch to {selected.name} to send transactions.
        </p>
      </div>
      <button onClick={() => switchChain({ chainId: selectedChainId })} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80" style={{ background: 'rgba(245,200,66,0.15)', color: 'var(--wht-gold)', border: '1px solid rgba(245,200,66,0.3)' }}>
        Switch
      </button>
    </div>
  )
}

interface ArconeDashboardProps {
  initialChainId?: number
  onChainChange?: (chainId: number) => void
}

export default function ArconeDashboard({ initialChainId, onChainChange }: ArconeDashboardProps = {}) {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const [selectedChainId, setSelectedChainId] = useState(initialChainId ?? DEFAULT_CHAIN_ID)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [modalEvent, setModalEvent] = useState<PayoutEvent | null>(null)
  const [activeTab, setActiveTab] = useState<'payouts' | 'receipts' | 'invoices'>('payouts')
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [realtimePayouts, setRealtimePayouts] = useState<PayoutEvent[]>([])

  const cfg = getChainConfig(selectedChainId)
  const USDC_ADDRESS = cfg.usdc
  const USDCDEC = usdcDecimalsFor(selectedChainId)

  // Realtime watcher — only runs for the selected chain
  useWatchContractEvent({
    address: cfg.payouts,
    abi: ARCONE_PAYOUTS_ABI,
    eventName: 'PayoutSent',
    chainId: selectedChainId,
    onLogs(logs) {
      for (const log of logs) {
        const a = (log as unknown as { args: Record<string, unknown> }).args
        if (!a) continue
        const ev: PayoutEvent = {
          payoutId: a.payoutId as bigint,
          sender: a.sender as string,
          recipient: a.recipient as string,
          grossAmount: a.grossAmount as bigint,
          withheldAmount: a.withheldAmount as bigint,
          netAmount: a.netAmount as bigint,
          withholdingBps: a.withholdingBps as number,
          memo: a.memo as string,
          timestamp: a.timestamp as bigint,
          txHash: (log as unknown as { transactionHash: string }).transactionHash ?? '',
          logIndex: (log as unknown as { logIndex: number }).logIndex ?? 0,
          blockNumber: (log as unknown as { blockNumber: bigint }).blockNumber ?? 0n,
        }
        setRealtimePayouts(prev => {
          const key = `${ev.txHash}:${ev.logIndex}`
          if (prev.some(p => `${p.txHash}:${p.logIndex}` === key)) return prev
          return [ev, ...prev]
        })
      }
    },
  })

  const { events, status, isFallback, isCapped: isPayoutsCapped } = usePayoutHistory(selectedChainId, realtimePayouts)
  const { items: invoices, status: invStatus, errorMsg: invError, isCapped: isInvCapped, refreshOne: refreshInvoice, prepend: prependInvoice } = useInvoiceList(selectedChainId, address)

  // Filter to connected wallet only
  const myEvents = address
    ? events.filter(e => e.sender.toLowerCase() === address.toLowerCase())
    : []

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address },
  })

  const formattedUsdc = usdcBalance !== undefined
    ? Amount.fromRaw(usdcBalance, USDCDEC).toFixed(2)
    : null

  const totalPaid = myEvents.reduce((s, e) => s + e.netAmount, 0n)
  const totalWHT = myEvents.reduce((s, e) => s + e.withheldAmount, 0n)
  const fmt = (v: bigint) => fmtUsdc(selectedChainId, v)

  const isWrongChain = isConnected && walletChainId !== undefined && walletChainId !== selectedChainId

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 flex items-center justify-between" style={{ height: 56, paddingLeft: 24, paddingRight: 20, background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <ArconeLockup h={32} />
        <div className="flex items-center gap-2">
          <NetworkSwitcher chainId={selectedChainId} onChange={id => { setSelectedChainId(id); setRealtimePayouts([]); onChainChange?.(id) }} />
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCreateInvoice(true)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}>
                <Plus className="size-3.5" />Invoice
              </button>
              <button onClick={() => setShowSendModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                <Plus className="size-3.5" />Payout
              </button>
            </div>
          )}
          <ConnectKitButton />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Wrong chain warning */}
        {isWrongChain && <WrongChainBanner walletChainId={walletChainId} selectedChainId={selectedChainId} />}

        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total paid out', value: !isConnected || status === 'loading' ? '—' : fmt(totalPaid), unit: 'USDC' },
            { label: 'WHT withheld', value: !isConnected || status === 'loading' ? '—' : fmt(totalWHT), unit: 'USDC' },
            { label: 'Transactions', value: status === 'loading' || !isConnected ? '—' : myEvents.length.toString(), unit: 'payouts' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-3.5" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>{stat.label}</p>
              <p className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{stat.value}</p>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{stat.unit}</p>
            </div>
          ))}
        </div>

        {/* Wallet balance */}
        {isConnected && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <TokenUSDC variant="branded" size={20} />
              <div>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Connected wallet</p>
                <p className="mono text-xs" style={{ color: 'var(--muted)' }}>{address ? address.slice(0, 8) + '…' + address.slice(-6) : ''}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="mono text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formattedUsdc ?? '—'}</p>
              <p className="text-[10px]" style={{ color: 'var(--subtle)' }}>USDC balance</p>
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect wallet to view live balance</p>
            <ConnectKitButton />
          </div>
        )}

        {/* Faucet strip — testnet only */}
        {cfg.isTestnet && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(77,157,224,0.07)', border: '1px solid rgba(77,157,224,0.18)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <TokenUSDC variant="branded" size={18} className="shrink-0" />
              <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>Need test USDC on {cfg.name}? Get some for free.</p>
            </div>
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
              Get test USDC<ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--surface-muted)' }}>
          {([{ id: 'payouts', label: 'Payouts' }, { id: 'receipts', label: 'WHT' }, { id: 'invoices', label: 'Invoices' }] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === id ? { background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' } : { color: 'var(--subtle)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Payout list */}
        {activeTab === 'payouts' && (
          <div className="space-y-2">
            {status === 'loading' && (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <Loader2 className="size-6 animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Fetching on-chain history…</p>
              </div>
            )}
            {status === 'error' && (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
                <p className="text-xs" style={{ color: 'var(--danger)' }}>Could not load on-chain history.</p>
              </div>
            )}
            {isFallback && myEvents.length > 0 && !isPayoutsCapped && (
              <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(245,200,66,0.07)', border: '1px solid rgba(245,200,66,0.18)' }}>
                <Clock className="size-3.5 shrink-0" style={{ color: 'var(--wht-gold)' }} />
                <p className="text-xs" style={{ color: 'var(--wht-gold)' }}>Loaded from chain — full history from contract deploy.</p>
              </div>
            )}
            {isPayoutsCapped && (
              <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(245,200,66,0.07)', border: '1px solid rgba(245,200,66,0.18)' }}>
                <Clock className="size-3.5 shrink-0" style={{ color: 'var(--wht-gold)' }} />
                <p className="text-xs" style={{ color: 'var(--wht-gold)' }}>Partial history shown — scan limit reached. Newest 600k blocks covered.</p>
              </div>
            )}
            {!isConnected && status !== 'loading' && (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <Globe className="size-8 opacity-30" style={{ color: 'var(--subtle)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Connect a wallet</p>
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Your payouts appear here once you connect.</p>
                <ConnectKitButton />
              </div>
            )}
            {isConnected && status === 'done' && myEvents.length === 0 && (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <FileText className="size-8 opacity-30" style={{ color: 'var(--subtle)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No payouts yet</p>
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Send the first payout to see it here.</p>
                <p className="mono text-[10px]" style={{ color: 'var(--subtle)' }}>Contract: {cfg.payouts.slice(0, 10)}…</p>
              </div>
            )}
            {isConnected && (status === 'done' || status === 'loading') && myEvents.map(ev => {
              const key = `${ev.txHash}:${ev.logIndex}`
              return (
                <PayoutRow key={key} ev={ev} chainId={selectedChainId}
                  expanded={expandedKey === key}
                  onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                  onExpand={() => { setModalEvent(ev); setExpandedKey(null) }}
                />
              )
            })}
          </div>
        )}

        {/* WHT Receipts tab */}
        {activeTab === 'receipts' && (
          <div className="space-y-3">
            {cfg.isTestnet && (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)' }}>
                <Clock className="size-4 shrink-0" style={{ color: 'var(--wht-gold)' }} />
                <p className="text-xs" style={{ color: 'var(--wht-gold)' }}>Testnet demo — receipts are on-chain proofs. PND.53 filing still requires rd.go.th e-filing.</p>
              </div>
            )}
            {status === 'loading' && (
              <div className="rounded-2xl p-6 flex items-center justify-center gap-2" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <Loader2 className="size-5 animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading receipts…</p>
              </div>
            )}
            {!isConnected && (
              <div className="rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect wallet to view your receipts</p>
                <ConnectKitButton />
              </div>
            )}
            {isConnected && status === 'done' && myEvents.length === 0 && (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-2" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No receipts yet</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>WHT receipts are generated automatically per payout.</p>
              </div>
            )}
            {isConnected && myEvents.map(ev => {
              const pct = (ev.withholdingBps / 100).toFixed(0)
              const wht = fmt(ev.withheldAmount)
              const net = fmt(ev.netAmount)
              const receiptId = `WHT-${ev.txHash.slice(2, 10).toUpperCase()}`
              const date = fmtDate(ev.timestamp)
              const tags = ['PND.53-ready', `${pct}% withheld`, 'on-chain proof']
              return (
                <div key={`${ev.txHash}:${ev.logIndex}`} className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mono text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>{receiptId}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{ev.recipient.slice(0, 8)}…{ev.recipient.slice(-6)}{date ? ` · ${date}` : ''}</p>
                    </div>
                    <CheckCircle2 className="size-5 shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{
                        background: tag === 'PND.53-ready' ? 'rgba(245,200,66,0.12)' : 'rgba(77,157,224,0.12)',
                        color: tag === 'PND.53-ready' ? 'var(--wht-gold)' : 'var(--accent)',
                        border: `1px solid ${tag === 'PND.53-ready' ? 'rgba(245,200,66,0.25)' : 'rgba(77,157,224,0.2)'}`,
                      }}>{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--subtle)' }}>WHT Amount</p>
                        <p className="mono text-sm font-bold tabular-nums" style={{ color: 'var(--danger)' }}>{wht} USDC</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--subtle)' }}>Net paid</p>
                        <p className="mono text-sm font-bold tabular-nums" style={{ color: 'var(--success)' }}>{net} USDC</p>
                      </div>
                    </div>
                    <a href={buildTxExplorer(selectedChainId, ev.txHash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                      On-chain proof <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Invoices tab */}
        {activeTab === 'invoices' && (
          <div className="space-y-3">
            {!isConnected ? (
              <div className="rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect wallet to create and view invoices</p>
                <ConnectKitButton />
              </div>
            ) : (
              <>
                <button onClick={() => setShowCreateInvoice(true)} className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-80 border-dashed" style={{ background: 'transparent', color: 'var(--accent)', border: '1.5px dashed rgba(77,157,224,0.4)' }}>
                  <Plus className="size-4" />New Invoice
                </button>
                {invStatus === 'loading' && (
                  <div className="rounded-2xl p-6 flex items-center justify-center gap-2" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                    <Loader2 className="size-5 animate-spin" style={{ color: 'var(--accent)' }} />
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading invoices…</p>
                  </div>
                )}
                {isInvCapped && (
                  <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(245,200,66,0.07)', border: '1px solid rgba(245,200,66,0.18)' }}>
                    <Clock className="size-3.5 shrink-0" style={{ color: 'var(--wht-gold)' }} />
                    <p className="text-xs" style={{ color: 'var(--wht-gold)' }}>Partial list — scan limit reached. Newest 600k blocks covered.</p>
                  </div>
                )}
                {invStatus === 'error' && (
                  <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
                    <p className="text-xs" style={{ color: 'var(--danger)' }}>{invError ?? 'Could not load invoices.'}</p>
                  </div>
                )}
                {invStatus === 'done' && invoices.length === 0 && (
                  <div className="rounded-2xl p-8 flex flex-col items-center gap-2" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                    <FileText className="size-8 opacity-30" style={{ color: 'var(--subtle)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No invoices yet</p>
                    <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Create an invoice and share the link to get paid.</p>
                  </div>
                )}
                {(invStatus === 'done' || invStatus === 'loading') && invoices.map(item => (
                  <InvoiceRow key={String(item.id)} item={item} chainId={selectedChainId} onRefresh={(id) => { void refreshInvoice(id) }} />
                ))}
              </>
            )}
          </div>
        )}

        <p className="text-center text-[10px] pb-4" style={{ color: 'var(--subtle)' }}>
          ARCone · Built on Arc · {cfg.name} · Contract: {cfg.payouts.slice(0, 10)}…
        </p>
      </div>

      {modalEvent && <TxDetailPanel ev={modalEvent} onClose={() => setModalEvent(null)} chainId={selectedChainId} />}
      {showSendModal && <SendPayoutModal chainId={selectedChainId} onClose={() => setShowSendModal(false)} onSuccess={() => setShowSendModal(false)} />}
      {showCreateInvoice && <CreateInvoiceModal chainId={selectedChainId} onClose={() => setShowCreateInvoice(false)} onCreated={(id) => { setShowCreateInvoice(false); setActiveTab('invoices'); void prependInvoice(id) }} />}
    </div>
  )
}
