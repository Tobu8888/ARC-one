import { useState, useCallback } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi, parseUnits } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { ArrowDown, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

const CHAIN_ID = 5042002 // Arc Testnet
const GATEWAY_ADDRESS = '0x44a80bdebe968139477bdc59a506d25cc69ad42a' as const
const THBT_ADDRESS = '0x2c8b48321deb9ebaed13c03403ee3a183d6dd9ff' as const
const THBT_DECIMALS = 2

const GATEWAY_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    outputs: [{ name: 'thbtAmount', type: 'uint256' }],
  },
  {
    name: 'thbtPerUsdc',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalUsdcReceived',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const usdcFact = getUsdc(CHAIN_ID)!
const USDC_ADDRESS = usdcFact.address as `0x${string}`

function parseOnchainError(error: unknown): string {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) return 'Transaction cancelled.'
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('reverted')) return 'Transaction failed — check your USDC approval.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}

interface SwapGatewayProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function SwapGateway({ theme, onToggleTheme }: SwapGatewayProps) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [amount, setAmount] = useState('')

  const wrongChain = isConnected && chainId !== CHAIN_ID

  // Read USDC balance
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })

  // Read THBT balance
  const { data: thbtBalance, refetch: refetchThbt } = useReadContract({
    address: THBT_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })

  // Read USDC allowance for gateway
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, GATEWAY_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })

  // Read current rate
  const { data: rate } = useReadContract({
    address: GATEWAY_ADDRESS,
    abi: GATEWAY_ABI,
    functionName: 'thbtPerUsdc',
    chainId: CHAIN_ID,
  })

  // Read quote live
  const parsedAmount = amount && !isNaN(Number(amount)) && Number(amount) > 0
    ? parseUnits(amount, usdcDecimalsFor(CHAIN_ID))
    : undefined

  const { data: quoteRaw } = useReadContract({
    address: GATEWAY_ADDRESS,
    abi: GATEWAY_ABI,
    functionName: 'getQuote',
    args: parsedAmount !== undefined ? [parsedAmount] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: parsedAmount !== undefined },
  })

  // Approve
  const {
    writeContract: approve,
    data: approveHash,
    isPending: approvePending,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Swap
  const {
    writeContract: swap,
    data: swapHash,
    isPending: swapPending,
    reset: resetSwap,
  } = useWriteContract()

  const { isLoading: swapConfirming, isSuccess: swapSuccess } = useWaitForTransactionReceipt({
    hash: swapHash,
  })

  const formattedUsdc = usdcBalance !== undefined
    ? Amount.fromRaw(usdcBalance, usdcDecimalsFor(CHAIN_ID)).toFixed(2)
    : null

  const formattedThbt = thbtBalance !== undefined
    ? Amount.fromRaw(thbtBalance, THBT_DECIMALS).toFixed(2)
    : null

  const quoteFormatted = quoteRaw !== undefined
    ? Amount.fromRaw(quoteRaw, THBT_DECIMALS).toFixed(2)
    : null

  const rateFormatted = rate !== undefined
    ? (Number(rate) / 100).toFixed(2)
    : null

  const needsApproval =
    parsedAmount !== undefined &&
    allowance !== undefined &&
    allowance < parsedAmount

  const canProceed =
    isConnected &&
    !wrongChain &&
    parsedAmount !== undefined &&
    usdcBalance !== undefined &&
    usdcBalance >= parsedAmount

  // After swap success — refresh balances
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchUsdc(), refetchThbt(), refetchAllowance()])
  }, [refetchUsdc, refetchThbt, refetchAllowance])

  const handleApprove = () => {
    if (!parsedAmount) return
    approve(
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [GATEWAY_ADDRESS, parsedAmount],
        chainId: CHAIN_ID,
      },
      {
        onSuccess: () => { void refetchAllowance() },
        onError: (err) => {
          toast.error(parseOnchainError(err))
          resetApprove()
        },
      },
    )
  }

  const handleSwap = () => {
    if (!parsedAmount) return
    swap(
      {
        address: GATEWAY_ADDRESS,
        abi: GATEWAY_ABI,
        functionName: 'swap',
        args: [parsedAmount],
        chainId: CHAIN_ID,
      },
      {
        onSuccess: () => { void handleRefresh() },
        onError: (err) => {
          toast.error(parseOnchainError(err))
          resetSwap()
        },
      },
    )
  }

  const handleReset = () => {
    setAmount('')
    resetApprove()
    resetSwap()
    void handleRefresh()
  }

  const isLoading = approvePending || approveConfirming || swapPending || swapConfirming
  const explorerApproveUrl = approveHash ? buildTxExplorerUrl(CHAIN_ID, approveHash) : null
  const explorerSwapUrl = swapHash ? buildTxExplorerUrl(CHAIN_ID, swapHash) : null

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={onToggleTheme}
          className="size-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
            color: 'var(--subtle)',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Header */}
      <div className="mb-8 text-center">
        <h1
          className="display text-3xl font-bold mb-1"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          USDC → THBT
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Thai Baht Token — Arc Testnet
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {/* Connect / Network banner */}
        {!isConnected && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
              Connect wallet to start swapping
            </span>
            <ConnectKitButton />
          </div>
        )}

        {wrongChain && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4" style={{ color: 'var(--danger)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
                Switch to Arc Testnet
              </span>
            </div>
            <button
              onClick={() => switchChain({ chainId: CHAIN_ID })}
              disabled={isSwitching}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity disabled:opacity-50"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {isSwitching ? 'Switching…' : 'Switch'}
            </button>
          </div>
        )}

        {/* Rate card */}
        {rateFormatted && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
              Rate
            </span>
            <span className="mono text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              1 USDC = {rateFormatted} THBT
            </span>
          </div>
        )}

        {/* Main swap card */}
        <div
          className="rounded-3xl p-5 space-y-3"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(24px)' }}
        >
          {/* Balances */}
          {isConnected && !wrongChain && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Your balances</span>
              <button onClick={() => void handleRefresh()} className="p-1 rounded-lg hover:opacity-60 transition-opacity">
                <RefreshCw className="size-3" style={{ color: 'var(--subtle)' }} />
              </button>
            </div>
          )}
          {isConnected && !wrongChain && (formattedUsdc !== null || formattedThbt !== null) && (
            <div className="flex gap-2 mb-3">
              <div
                className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
                style={{ background: 'var(--surface-muted)' }}
              >
                <TokenUSDC variant="branded" size={16} />
                <span className="mono text-sm tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>
                  {formattedUsdc ?? '…'}
                </span>
                <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>
              <div
                className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
                style={{ background: 'var(--surface-muted)' }}
              >
                <div
                  className="size-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ background: '#1a3a5c', color: '#fff' }}
                >฿</div>
                <span className="mono text-sm tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>
                  {formattedThbt ?? '…'}
                </span>
                <span className="text-xs" style={{ color: 'var(--subtle)' }}>THBT</span>
              </div>
            </div>
          )}

          {/* Input: You Pay */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
                You Pay
              </span>
              {formattedUsdc && (
                <button
                  onClick={() => setAmount(formattedUsdc)}
                  className="text-xs font-semibold hover:opacity-60 transition-opacity"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  Max: {formattedUsdc}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                }}
                placeholder="0.00"
                disabled={isLoading || swapSuccess}
                className="display flex-1 bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:opacity-25 disabled:opacity-50"
                style={{ color: 'var(--ink)' }}
              />
              <div
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
              >
                <TokenUSDC variant="branded" size={18} />
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>USDC</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div
              className="size-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
            >
              <ArrowDown className="size-4" style={{ color: 'var(--subtle)' }} />
            </div>
          </div>

          {/* Output: You Receive */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: 'var(--subtle)' }}>
              You Receive
            </span>
            <div className="flex items-center gap-3">
              <span
                className="display flex-1 text-3xl font-bold tabular-nums"
                style={{ color: quoteFormatted ? 'var(--success)' : 'var(--border-strong)' }}
              >
                {quoteFormatted ?? '0.00'}
              </span>
              <div
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
              >
                <div
                  className="size-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: '#1a3a5c', color: '#fff' }}
                >฿</div>
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>THBT</span>
              </div>
            </div>
          </div>

          {/* Success state */}
          {swapSuccess && swapHash && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(26,128,71,0.07)', border: '1px solid rgba(26,128,71,0.2)' }}
            >
              <CheckCircle2 className="size-5 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                  Swap confirmed!
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {quoteFormatted} THBT sent to your wallet
                </p>
                {explorerSwapUrl && (
                  <a
                    href={explorerSwapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs mt-1.5 font-medium hover:underline"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    View transaction <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-semibold shrink-0"
                style={{ color: 'var(--muted)' }}
              >
                New swap
              </button>
            </div>
          )}

          {/* Approve progress */}
          {(approvePending || approveConfirming) && (
            <div
              className="rounded-2xl p-3 flex items-center gap-2"
              style={{ background: 'rgba(16,97,166,0.06)', border: '1px solid rgba(16,97,166,0.15)' }}
            >
              <Loader2 className="size-4 animate-spin shrink-0" style={{ color: 'var(--accent-hover)' }} />
              <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
                {approvePending ? 'Confirm approval in wallet…' : 'Approval confirming…'}
              </span>
            </div>
          )}

          {/* Approve tx link */}
          {approveSuccess && explorerApproveUrl && !swapSuccess && (
            <div className="flex justify-end">
              <a
                href={explorerApproveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: 'var(--muted)' }}
              >
                Approval confirmed <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {/* CTA */}
          {!swapSuccess && (
            <>
              {!isConnected ? (
                <div className="flex justify-center pt-1">
                  <ConnectKitButton />
                </div>
              ) : wrongChain ? (
                <button
                  onClick={() => switchChain({ chainId: CHAIN_ID })}
                  disabled={isSwitching}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}
                >
                  Switch to Arc Testnet
                </button>
              ) : needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={!canProceed || approvePending || approveConfirming}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}
                >
                  {(approvePending || approveConfirming) ? (
                    <><Loader2 className="size-4 animate-spin" />{approvePending ? 'Confirm in wallet…' : 'Approving…'}</>
                  ) : (
                    'Approve USDC'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={!canProceed || swapPending || swapConfirming}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}
                >
                  {(swapPending || swapConfirming) ? (
                    <><Loader2 className="size-4 animate-spin" />{swapPending ? 'Confirm in wallet…' : 'Confirming…'}</>
                  ) : (
                    'Swap to THBT'
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
          Thai Baht Token (THBT) is a testnet token for demonstration only
        </p>
      </div>
    </div>
  )
}
