import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { erc20Abi, isAddress, parseAbiItem } from 'viem'
import { X, ArrowRight, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { parseUsdc, formatUsdc, usdcDecimalsFor } from '@/onchain-money'
import { ARCONE_PAYOUTS_ABI } from '@/contracts/ArconePayouts'
import { getChainConfig, buildTxExplorer } from '@/chainConfig'

const ERC20_APPROVE_ABI = [parseAbiItem('function approve(address spender, uint256 amount) returns (bool)')]

type Step = 'form' | 'approve' | 'approving' | 'send' | 'sending' | 'done'

interface Props {
  chainId: number
  onClose: () => void
  onSuccess: () => void
}

export default function SendPayoutModal({ chainId, onClose, onSuccess }: Props) {
  const { address } = useAccount()
  const cfg = getChainConfig(chainId)
  const USDCDEC = usdcDecimalsFor(chainId)
  const USDC_ADDRESS = cfg.usdc
  const GAS_HEADROOM = BigInt(Math.round(0.01 * 10 ** USDCDEC))

  const [recipient, setRecipient] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<string | null>(null)

  const gross = (() => { try { return amountStr ? parseUsdc(amountStr) : 0n } catch { return 0n } })()

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  })
  const balance = balanceRaw ?? 0n
  const maxPayable = balance > GAS_HEADROOM ? balance - GAS_HEADROOM : 0n
  const overBalance = gross > 0n && gross > maxPayable
  const shortfall = overBalance ? gross - maxPayable : 0n

  const { data: quote } = useReadContract({
    address: cfg.payouts,
    abi: ARCONE_PAYOUTS_ABI,
    functionName: 'getQuote',
    args: gross > 0n ? [gross] : undefined,
    chainId,
    query: { enabled: gross > 0n },
  })
  const withheld = (quote as [bigint, bigint] | undefined)?.[0] ?? 0n
  const net = (quote as [bigint, bigint] | undefined)?.[1] ?? 0n

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, cfg.payouts] : undefined,
    chainId,
    query: { enabled: !!address },
  })

  const { writeContractAsync } = useWriteContract()
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
    query: { enabled: !!txHash && (step === 'approving' || step === 'sending') },
  })

  if (txConfirmed && step === 'approving') { void refetchAllowance(); setStep('send'); setTxHash(undefined) }
  if (txConfirmed && step === 'sending') setStep('done')

  const isValidForm = isAddress(recipient) && gross > 0n && memo.trim().length > 0 && !overBalance
  const needsApproval = (allowance ?? 0n) < gross
  const handleSubmitForm = () => { if (!isValidForm) return; setStep(needsApproval ? 'approve' : 'send') }

  const handleApprove = useCallback(async () => {
    setError(null); setStep('approving')
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [cfg.payouts, gross],
        chainId,
      })
      setTxHash(hash)
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Approval failed')
      setStep('approve')
    }
  }, [writeContractAsync, gross, cfg.payouts, chainId, USDC_ADDRESS])

  const handleSend = useCallback(async () => {
    setError(null); setStep('sending')
    try {
      const hash = await writeContractAsync({
        address: cfg.payouts,
        abi: ARCONE_PAYOUTS_ABI,
        functionName: 'sendPayout',
        args: [recipient as `0x${string}`, gross, memo],
        chainId,
      })
      setTxHash(hash)
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Transaction failed')
      setStep('send')
    }
  }, [writeContractAsync, recipient, gross, memo, cfg.payouts, chainId])

  const fmtUsdc = (v: bigint) => (Number(v) / 10 ** USDCDEC).toFixed(2)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(7,16,30,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: '#0d1b2f', border: '1px solid var(--border-strong)' }}
        onClick={e => e.stopPropagation()}>
        <div className="h-0.5" style={{ background: 'var(--accent)' }} />
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>arcpay · ARCone · {cfg.name}</p>
            <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>New Payout</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" style={{ background: 'var(--surface-strong)', color: 'var(--ink)' }}>
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {(step === 'form' || step === 'approve' || step === 'send') && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--subtle)' }}>Recipient wallet</label>
                <input type="text" placeholder="0x..." value={recipient} onChange={e => setRecipient(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                  style={{ background: 'var(--surface-muted)', border: `1px solid ${recipient && !isAddress(recipient) ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--ink)' }} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Gross amount (USDC)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>Balance: {fmtUsdc(balance)} USDC</span>
                    <button type="button" onClick={() => setAmountStr(formatUsdc(maxPayable))}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(77,157,224,0.15)', color: 'var(--accent)' }}>Max</button>
                  </div>
                </div>
                <div className="relative">
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none pr-16"
                    style={{ background: 'var(--surface-muted)', border: `1px solid ${overBalance ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--ink)' }} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <TokenUSDC variant="mono" size={14} />
                    <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
                  </div>
                </div>
                {overBalance && <p className="text-[11px] mt-1" style={{ color: 'var(--danger)' }}>Insufficient balance — {fmtUsdc(shortfall)} USDC short</p>}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--subtle)' }}>Memo</label>
                <input type="text" placeholder="e.g. design fee" value={memo} onChange={e => setMemo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
              </div>

              {gross > 0n && quote && (
                <div className="rounded-2xl p-3.5 space-y-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Payout Breakdown</p>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--ink-2)' }}>Gross</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{fmtUsdc(gross)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--ink-2)' }}>Withholding 3%</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--danger)' }}>-{fmtUsdc(withheld)} USDC</span>
                  </div>
                  <div className="h-px" style={{ background: 'var(--border)' }} />
                  <div className="flex justify-between">
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>Net to payee</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{fmtUsdc(net)} USDC</span>
                  </div>
                </div>
              )}

              {error && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}

              {step === 'form' && (
                <button onClick={handleSubmitForm} disabled={!isValidForm}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                  Review payout <ArrowRight className="size-4" />
                </button>
              )}

              {step === 'approve' && (
                <div className="space-y-2">
                  <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>First, approve USDC spending — one-time per session.</p>
                  <button onClick={() => { void handleApprove() }}
                    className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                    Approve USDC <ArrowRight className="size-4" />
                  </button>
                </div>
              )}

              {step === 'send' && (
                <button onClick={() => { void handleSend() }}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                  Send payout <ArrowRight className="size-4" />
                </button>
              )}
            </>
          )}

          {(step === 'approving' || step === 'sending') && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {step === 'approving' ? 'Approving USDC…' : 'Broadcasting payout…'}
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>Signing locally — key never leaves your device</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-6 flex flex-col items-center gap-3">
              <CheckCircle2 className="size-10" style={{ color: 'var(--success)' }} />
              <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>Payout sent!</p>
              <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
                {fmtUsdc(net)} USDC sent to {recipient.slice(0, 8)}…{recipient.slice(-6)}
                <br />WHT receipt recorded on-chain.
              </p>
              {txHash && (
                <a href={buildTxExplorer(chainId, txHash)} target="_blank" rel="noreferrer"
                  className="text-xs font-mono hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  View on explorer <ExternalLink className="size-3" />
                </a>
              )}
              <button onClick={() => { onSuccess(); onClose() }} className="mt-2 w-full py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
