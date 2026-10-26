// Admin › Negócios (audit 2026-10-25, web-app §admin: "Negócios — lista de todos os Deal, fase,
// garantia, repasse com falha, Tentar de novo") — PURE: the row the desk reads, the filters, the
// KPIs and the words. The server (server.ts) reads the rows; the page and the island show them.
import { DEAL_PHASES, PHASE_STEPS, type DealPhase } from '@/lib/deals/domain'
import { MANUAL_PAYOUT_PREFIX, SPLIT_PAYOUT_LABELS, type SplitPayoutState } from '@/lib/stripe/connect-core'
export { MANUAL_PAYOUT_PREFIX }

export const DEAL_FILTERS = ['open', 'escrow', 'payout', 'failed', 'dispute', 'completed', 'cancelled', 'all'] as const
export type DealFilter = (typeof DEAL_FILTERS)[number]
export const DEAL_FILTER_LABELS: Record<DealFilter, string> = {
  open: 'Em andamento', escrow: 'Aguardando garantia', payout: 'Repasse a fazer', failed: 'Repasse com falha', dispute: 'Em disputa', completed: 'Concluídos', cancelled: 'Cancelados', all: 'Todos',
}
export const filterKey = (raw: string | undefined): DealFilter => (DEAL_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as DealFilter) : 'open'

export interface AdminSplitLine { id: number; party: string; label: string; amountCents: string; status: string; payoutState: SplitPayoutState; payoutLabel: string; payoutError: string | null; payee: string | null }

export interface AdminDealRow {
  id: number; code: string; phase: DealPhase; phaseLabel: string; exception: string | null
  artworkTitle: string; artworkId: number; artist: string; seller: string; sellerKind: string; buyer: string
  market: string; amountCents: string; totalCents: string
  escrow: { state: 'PAID' | 'PENDING' | 'UNPAID'; label: string }
  splits: AdminSplitLine[]
  createdAt: string; completedAt: string | null
}

export const PHASE_LABELS: Record<DealPhase, string> = Object.fromEntries([...PHASE_STEPS.map((s) => [s.phase, s.title]), ['COMPLETED', 'Concluído']]) as Record<DealPhase, string>
export const isPhase = (v: string): v is DealPhase => (DEAL_PHASES as readonly string[]).includes(v)

const EXCEPTION_LABELS: Record<string, string> = { CANCELLED: 'Cancelado', DISPUTE: 'Em disputa' }
export const exceptionLabel = (v: string | null) => (v ? EXCEPTION_LABELS[v] ?? v : null)

const METHOD: Record<string, string> = { CARD: 'cartão', PIX: 'Pix', BOLETO: 'boleto' }

/** "Pago em 12/10 · Pix" · "Pix aguardando pagamento · vence 13/10" · "Não pago". */
export function escrowOf(d: { escrowPaidAt: string | null; escrowMethod: string | null; escrowPendingRef: string | null; escrowExpiresAt: string | null }, fmt: (iso: string) => string): AdminDealRow['escrow'] {
  if (d.escrowPaidAt) return { state: 'PAID', label: `Pago em ${fmt(d.escrowPaidAt)}${d.escrowMethod ? ` · ${METHOD[d.escrowMethod] ?? d.escrowMethod}` : ''}` }
  if (d.escrowPendingRef) return { state: 'PENDING', label: `${d.escrowMethod ? (METHOD[d.escrowMethod] ?? d.escrowMethod) : 'Pagamento'} aguardando${d.escrowExpiresAt ? ` · vence ${fmt(d.escrowExpiresAt)}` : ''}` }
  return { state: 'UNPAID', label: 'Não pago' }
}

/** The desk reads the note of a manual payout next to the state. */
export const payoutLabelOf = (s: SplitPayoutState, payoutRef?: string | null) => s === 'MANUAL_PAID' && payoutRef ? `${SPLIT_PAYOUT_LABELS[s]} · ${payoutRef.slice(MANUAL_PAYOUT_PREFIX.length)}` : SPLIT_PAYOUT_LABELS[s]

/** Lines the desk can mark as paid by hand: released, not transferred by Stripe, owed to someone. */
export const canMarkPaid = (l: { status: string; payoutState: SplitPayoutState }) => l.status === 'RELEASED' && (l.payoutState === 'MANUAL' || l.payoutState === 'FAILED' || l.payoutState === 'AWAITING_ACCOUNT')

export function matchesFilter(d: AdminDealRow, f: DealFilter): boolean {
  const cancelled = d.exception === 'CANCELLED'
  const released = d.splits.some((s) => s.status === 'RELEASED')
  switch (f) {
    case 'all': return true
    case 'open': return !cancelled && d.phase !== 'COMPLETED'
    case 'escrow': return !cancelled && d.escrow.state !== 'PAID' && d.phase !== 'COMPLETED'
    case 'payout': return !cancelled && released
    case 'failed': return d.splits.some((s) => s.payoutState === 'FAILED')
    case 'dispute': return d.exception === 'DISPUTE'
    case 'completed': return d.phase === 'COMPLETED' && !cancelled
    case 'cancelled': return cancelled
  }
}

export interface DealKpis { open: number; escrowCents: bigint; releasedCents: bigint; releasedCount: number; failed: number; disputes: number }

/** The numbers above the list, from every row (not the filtered ones). */
export function dealKpis(rows: AdminDealRow[]): DealKpis {
  const k: DealKpis = { open: 0, escrowCents: 0n, releasedCents: 0n, releasedCount: 0, failed: 0, disputes: 0 }
  for (const d of rows) {
    const cancelled = d.exception === 'CANCELLED'
    if (cancelled) continue
    if (d.phase !== 'COMPLETED') { k.open += 1; if (d.escrow.state === 'PAID') k.escrowCents += BigInt(d.totalCents) }
    const rel = d.splits.filter((s) => s.status === 'RELEASED')
    if (rel.length) { k.releasedCount += 1; for (const s of rel) k.releasedCents += BigInt(s.amountCents) }
    if (d.splits.some((s) => s.payoutState === 'FAILED')) k.failed += 1
    if (d.exception === 'DISPUTE') k.disputes += 1
  }
  return k
}

export const MANUAL_NOTE_MAX = 120
