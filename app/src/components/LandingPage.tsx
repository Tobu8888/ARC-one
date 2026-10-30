import { ArrowRight, Zap, Shield, FileText, Globe, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import ArconeLockup from '@/components/ArconeLockup'
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/chainConfig'

const FEATURES = [
  {
    icon: Zap,
    title: 'Settled in seconds',
    body: 'USDC on Arc confirms in under 2 seconds. No SWIFT delays, no FX spread, no correspondent banks.',
  },
  {
    icon: Shield,
    title: 'Withholding tax — automatic',
    body: 'Outbound payouts automatically withhold 3% and emit an on-chain WHT receipt per transaction — PND.53-ready for your accounting.',
  },
  {
    icon: FileText,
    title: 'Invoice to pay link',
    body: 'Create an invoice in seconds and share a link. Your client pays the full amount in USDC — withholding is their responsibility as the payer.',
  },
  {
    icon: Globe,
    title: 'Cross-border, non-custodial',
    body: 'Your keys never leave your device. Pay contractors in PH, VN, DE, SG — same flow, same gas cost, any country.',
  },
]

const STEPS = [
  { n: '01', label: 'Connect wallet', sub: 'MetaMask, WalletConnect, or any EVM wallet' },
  { n: '02', label: 'Send a payout', sub: 'Enter address, amount, memo — contract withholds 3% WHT and emits an on-chain receipt' },
  { n: '03', label: 'Or create an invoice', sub: 'Share a link — client pays the full amount, withholding is on them' },
]

export default function LandingPage({ onEnter, chainId = DEFAULT_CHAIN_ID }: { onEnter: () => void; chainId?: number }) {
  const cfg = getChainConfig(chainId)
  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--bg-gradient)', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Nav */}
      <nav
        className="flex items-center justify-between"
        style={{
          height: 56,
          paddingLeft: 24,
          paddingRight: 20,
          background: 'rgba(7,16,30,0.0)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <ArconeLockup h={32} />
        <button
          onClick={onEnter}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
          style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)' }}
        >
          Launch App
          <ArrowRight className="size-3.5" />
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16">
        {/* Eyebrow */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{ background: 'rgba(77,157,224,0.12)', color: 'var(--accent)', border: '1px solid rgba(77,157,224,0.25)' }}
        >
          <div className="size-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
          Built on Arc · USDC-native · {cfg.name}
        </div>

        {/* Headline */}
        <h1
          className="max-w-xl mb-5"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'var(--ink)',
            textWrap: 'balance',
          }}
        >
          Cross-border payouts.{' '}
          <span style={{ color: 'var(--accent)' }}>Settled in seconds.</span>
        </h1>

        {/* Sub */}
        <p
          className="max-w-md mb-10 text-pretty"
          style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--muted)' }}
        >
          ARCone handles USDC payouts with automatic 3% WHT receipts (PND.53-ready),
          and shareable invoices for full-amount settlement — all on-chain, non-custodial.
        </p>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap justify-center">
          <button
            onClick={onEnter}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)', boxShadow: '0 0 32px rgba(77,157,224,0.35)' }}
          >
            Open Dashboard
            <ArrowRight className="size-4" />
          </button>
          <a
            href="https://explorer.arc.io/address/0x0F225c0FfB0bD7c5C50732Ab9e9D9BD91Ca79ea4"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
          >
            <TokenUSDC variant="branded" size={16} />
            View on Explorer
          </a>
          {cfg.isTestnet && (
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(77,157,224,0.10)', color: 'var(--accent)', border: '1px solid rgba(77,157,224,0.25)' }}
            >
              Get test USDC
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        {/* Stats strip */}
        <div
          className="flex items-center gap-6 mt-12 px-6 py-3 rounded-2xl"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          {[
            { value: '<2s', label: 'Confirmation' },
            { value: '~$0.004', label: 'Payout gas (approve + send)' },
            { value: '3%', label: 'WHT auto-split' },
            { value: '2', label: 'Contracts live' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="tabular-nums font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.1rem', color: 'var(--ink)' }}
              >
                {s.value}
              </p>
              <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--subtle)' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-2xl mx-auto w-full px-6 pb-16">
        <p className="text-[10px] uppercase tracking-[0.14em] mb-6 text-center" style={{ color: 'var(--subtle)' }}>
          How it works
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="flex-1 rounded-2xl p-4"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
            >
              <p
                className="mono text-xs font-bold mb-2"
                style={{ color: 'var(--accent)', opacity: 0.7 }}
              >
                {s.n}
              </p>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{s.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-2xl mx-auto w-full px-6 pb-20">
        <p className="text-[10px] uppercase tracking-[0.14em] mb-6 text-center" style={{ color: 'var(--subtle)' }}>
          Why ARCone
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl p-5"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
            >
              <div
                className="size-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(77,157,224,0.12)' }}
              >
                <Icon className="size-4" style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{title}</p>
              <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--muted)' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        className="mx-4 mb-8 rounded-3xl p-8 flex flex-col items-center text-center"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-strong)' }}
      >
        <p
          className="font-bold mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.4rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          Start paying contractors smarter
        </p>
        <p className="text-sm mb-6 text-pretty max-w-sm" style={{ color: 'var(--muted)' }}>
          No banks. No FX fees. No paperwork. Just USDC on Arc — non-custodial, on-chain, right now.
        </p>
        <button
          onClick={onEnter}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'var(--accent)', color: 'var(--accent-cta-text)', boxShadow: '0 0 24px rgba(77,157,224,0.3)' }}
        >
          Open Dashboard
          <ArrowRight className="size-4" />
        </button>
      </section>

      {/* Footer */}
      <footer className="text-center pb-8 text-[10px]" style={{ color: 'var(--subtle)' }}>
        ARCone · Built on Arc · USDC-native
      </footer>
    </div>
  )
}
