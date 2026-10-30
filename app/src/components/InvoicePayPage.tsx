import { useState } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { CheckCircle2, Loader2, Clock, XCircle, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ARCONE_INVOICE_ABI, type InvoiceData } from '@/contracts/ArconeInvoice'
import { getChainConfig, buildTxExplorer } from '@/chainConfig'
import ArconeLockup from '@/components/ArconeLockup'
import { DEFAULT_CHAIN_ID } from '@/chainConfig'

const STATUS_LABELS = ['Pending', 'Paid', 'Cancelled']
const PAGE_LOAD_SEC = BigInt(Math.floor(performance.timeOrigin / 1000))

interface Props { invoiceId: string }

type PayStep = 'idle' | 'approving' | 'paying' | 'done'

export default function InvoicePayPage({ invoiceId }: Props) {
  const { address, isConnected } = useAccount()
  // Invoice pay page always uses the chain the invoice was created on.
  // For simplicity we use DEFAULT_CHAIN_ID (Arc Mainnet). If the user switches
  // chains in the parent, the chainId prop could be threaded here, but for the
  // public pay link we always target mainnet.
  const chainId = DEFAULT_CHAIN_ID
  const cfg = getChainConfig(chainId)
  const USDC_ADDRESS = cfg.usdc
  const [payStep, setPayStep] = useState<PayStep>('idle')
  const [payTxHash, setPayTxHash] = useState<`0x${string}` | null>(null)
  const [error, setError] = useState<string | null>(null)

  const idBn = BigInt(invoiceId)

  const { data: rawInvoice, isLoading: invoiceLoading, isError: invoiceError } = useReadContract({
    address: cfg.invoice,
    abi: ARCONE_INVOICE_ABI,
    functionName: 'getInvoice',
    args: [idBn],
    chainId,
  })

  const invoice = rawInvoice as InvoiceData | undefined

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && invoice ? [address, cfg.invoice] : undefined,
    chainId,
    query: { enabled: !!address && !!invoice },
  })

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  })
  const payerBalance = (balanceRaw) ?? 0n
  const insufficientBalance = invoice ? payerBalance < invoice.amount : false
  const shortfall = insufficientBalance && invoice ? invoice.amount - payerBalance : 0n

  const { writeContractAsync } = useWriteContract()
  const { data: payReceipt } = useWaitForTransactionReceipt({
    hash: payTxHash ?? undefined,
    chainId,
  })

  if (payReceipt && payStep === 'paying') setPayStep('done')

  const needsApprove = invoice && allowance !== undefined && allowance < invoice.amount

  const handleApprove = async () => {
    if (!invoice) return
    setError(null)
    setPayStep('approving')
    try {
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [cfg.invoice, invoice.amount],
        chainId,
      })
      setPayStep('idle')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Approval failed')
      setPayStep('idle')
    }
  }

  const handlePay = async () => {
    setError(null)
    setPayStep('paying')
    try {
      const hash = await writeContractAsync({
        address: cfg.invoice,
        abi: ARCONE_INVOICE_ABI,
        functionName: 'payInvoice',
        args: [idBn],
        chainId,
      })
      setPayTxHash(hash)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Payment failed')
      setPayStep('idle')
    }
  }

  const fmt = (v: bigint) => Amount.fromRaw(v, usdcDecimalsFor(chainId)).toFixed(2)
  const isOverdue = invoice
    ? invoice.status === 0 && invoice.dueDate > 0n && PAGE_LOAD_SEC > invoice.dueDate
    : false

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      <nav className="flex items-center justify-between px-6"
        style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(16px)' }}>
        <ArconeLockup h={32} />
        <ConnectKitButton />
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-4">

          {invoiceLoading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="size-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading invoice…</p>
            </div>
          )}

          {invoiceError && (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
              <XCircle className="size-10 mx-auto mb-2" style={{ color: 'var(--danger)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Invoice not found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>ID #{invoiceId} doesn't exist on-chain</p>
            </div>
          )}

          {invoice && (
            <>
              <div className="rounded-3xl overflow-hidden" style={{ background: '#0d1b2f', border: '1px solid var(--border-strong)' }}>
                <div className="h-0.5" style={{ background: invoice.status === 1 ? 'var(--success)' : invoice.status === 2 ? 'var(--danger)' : 'var(--accent)' }} />
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Invoice #{invoiceId}</p>
                    <div className="flex items-center gap-1.5">
                      {isOverdue && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,200,66,0.15)', color: 'var(--wht-gold)', border: '1px solid rgba(245,200,66,0.3)' }}>
                          Overdue
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: invoice.status === 1 ? 'rgba(52,199,89,0.15)' : invoice.status === 2 ? 'rgba(255,69,58,0.15)' : 'rgba(77,157,224,0.15)',
                        color: invoice.status === 1 ? 'var(--success)' : invoice.status === 2 ? 'var(--danger)' : 'var(--accent)',
                      }}>
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-4xl font-bold tabular-nums display" style={{ color: 'var(--ink)' }}>{fmt(invoice.amount)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TokenUSDC variant="branded" size={14} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium mb-4" style={{ color: 'var(--ink-2)' }}>{invoice.memo}</p>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--subtle)' }}>Payee</span>
                      <span className="mono" style={{ color: 'var(--muted)' }}>{invoice.payee.slice(0,8)}…{invoice.payee.slice(-6)}</span>
                    </div>
                    {invoice.dueDate > 0n && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1" style={{ color: 'var(--subtle)' }}><Clock className="size-3" />Due</span>
                        <span style={{ color: 'var(--muted)' }}>{new Date(Number(invoice.dueDate) * 1000).toLocaleDateString()}</span>
                      </div>
                    )}
                    {invoice.status === 1 && invoice.paidAt > 0n && (
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--subtle)' }}>Paid at</span>
                        <span style={{ color: 'var(--success)' }}>{new Date(Number(invoice.paidAt) * 1000).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--subtle)' }}>Network</span>
                      <span style={{ color: 'var(--muted)' }}>{cfg.name}</span>
                    </div>
                  </div>
                </div>

                {invoice.status === 0 && (
                  <div className="px-5 pb-5 pt-2 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    {!isConnected ? (
                      <div className="pt-2 flex flex-col items-center gap-2">
                        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Connect wallet to pay this invoice</p>
                        <ConnectKitButton />
                      </div>
                    ) : payStep === 'done' ? (
                      <div className="py-4 flex flex-col items-center gap-2">
                        <CheckCircle2 className="size-8" style={{ color: 'var(--success)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Payment sent!</p>
                        {payTxHash && (
                          <a href={buildTxExplorer(chainId, payTxHash)} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                            View on explorer <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <>
                        {isConnected && (
                          <div className="flex items-center justify-between text-[11px] px-1">
                            <span style={{ color: 'var(--subtle)' }}>Your balance</span>
                            <span className="tabular-nums font-semibold" style={{ color: insufficientBalance ? 'var(--danger)' : 'var(--muted)' }}>
                              {fmt(payerBalance)} USDC
                            </span>
                          </div>
                        )}
                        {insufficientBalance && (
                          <p className="text-[11px] px-1" style={{ color: 'var(--danger)' }}>
                            Insufficient balance — {fmt(shortfall)} USDC short
                          </p>
                        )}
                        {needsApprove && (
                          <button onClick={() => { void handleApprove() }}
                            disabled={payStep === 'approving' || insufficientBalance}
                            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                            style={{ background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}>
                            {payStep === 'approving' ? <Loader2 className="size-4 animate-spin" /> : null}
                            Approve USDC
                          </button>
                        )}
                        <button onClick={() => { void handlePay() }}
                          disabled={!!needsApprove || payStep === 'paying' || payStep === 'approving' || insufficientBalance}
                          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 hover:opacity-90"
                          style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                          {payStep === 'paying' ? <Loader2 className="size-4 animate-spin" /> : <TokenUSDC variant="mono" size={16} />}
                          Pay {fmt(invoice.amount)} USDC
                        </button>
                        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>

              <p className="text-center text-[10px]" style={{ color: 'var(--subtle)' }}>
                ARCone · Built on Arc · USDC-native · Non-custodial
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
