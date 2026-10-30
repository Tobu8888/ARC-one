import { useState } from 'react'
import ArconeDashboard from '@/components/ArconeDashboard'
import InvoicePayPage from '@/components/InvoicePayPage'
import LandingPage from '@/components/LandingPage'
import { DEFAULT_CHAIN_ID } from '@/chainConfig'

export default function App() {
  const path = window.location.pathname
  const search = window.location.search
  const params = new URLSearchParams(search)

  // ?invoice=<id> — shareable query-string form (works on static hosts)
  const qsInvoice = params.get('invoice')
  if (qsInvoice && /^\d+$/.test(qsInvoice)) {
    return <InvoicePayPage invoiceId={qsInvoice} />
  }

  // /invoice/:id — legacy path form kept for in-app navigation
  const invoiceMatch = path.match(/^\/invoice\/(\d+)$/)
  if (invoiceMatch) {
    return <InvoicePayPage invoiceId={invoiceMatch[1]} />
  }

  // ?app=1 — shareable dashboard URL (works on static hosts)
  if (params.get('app') === '1') {
    return <Dashboard />
  }

  // /app — legacy path form kept for in-app navigation
  if (path === '/app') {
    return <Dashboard />
  }

  return <Root />
}

function Root() {
  const [entered, setEntered] = useState(false)
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID)
  if (entered) return <ArconeDashboard initialChainId={chainId} onChainChange={setChainId} />
  return (
    <LandingPage
      chainId={chainId}
      onEnter={() => {
        window.history.pushState({}, '', '/?app=1')
        setEntered(true)
      }}
    />
  )
}

function Dashboard() {
  return <ArconeDashboard />
}
