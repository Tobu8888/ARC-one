import artifact from '../../contracts/out/ArconeInvoice.sol/ArconeInvoice.json'

// Addresses are in chainConfig.ts keyed by chainId — do not add them here.
export const ARCONE_INVOICE_ABI = artifact.abi

export type InvoiceStatus = 0 | 1 | 2 // Pending | Paid | Cancelled

export interface InvoiceData {
  id: bigint
  payee: string
  payer: string
  amount: bigint
  memo: string
  dueDate: bigint
  status: InvoiceStatus
  paidAt: bigint
}
