// Admin › KYC — pure rules: the derived status of a verification (an approved one past its
// expiry reads EXPIRED), the filters, what the desk may do with each row. The audit item
// (docs/audit-ux-2026-10-25/web-app.md §5) asked for the queue, reject and revalidate.
import { canApproveMembers } from '@/lib/auth/profiles'

export const KYC_FILTERS = ['pending', 'approved', 'expired', 'rejected', 'pep', 'all'] as const
export type KycFilter = (typeof KYC_FILTERS)[number]
export const KYC_FILTER_LABELS: Record<KycFilter, string> = { pending: 'Na fila', approved: 'Aprovadas', expired: 'Vencidas', rejected: 'Reprovadas', pep: 'Alerta PEP', all: 'Todas' }
export const filterKey = (raw: string | undefined): KycFilter => (KYC_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as KycFilter) : 'pending'

export type KycState = 'PENDING' | 'APPROVED' | 'EXPIRED' | 'REJECTED'
export const KYC_STATE_LABELS: Record<KycState, string> = { PENDING: 'Na fila', APPROVED: 'Aprovada', EXPIRED: 'Vencida', REJECTED: 'Reprovada' }
export const PROVIDER_LABELS: Record<string, string> = { mock: 'simulado', didit: 'Didit', manual: 'equipe' }
/** How long an approval by the desk lasts (the mock provider uses the same year). */
export const APPROVAL_DAYS = 365
export const DECISION_NOTE_MAX = 200

export const stateOf = (v: { status: string; expiresAt: string | Date | null }, now: Date): KycState => {
  if (v.status === 'APPROVED') return v.expiresAt && new Date(v.expiresAt) < now ? 'EXPIRED' : 'APPROVED'
  if (v.status === 'EXPIRED' || v.status === 'REJECTED' || v.status === 'PENDING') return v.status
  return 'PENDING'
}

export interface AdminKycRow {
  id: number; userId: number; name: string; email: string; profile: string
  provider: string; providerLabel: string; state: KycState; stateLabel: string
  scoreBps: number | null; pepHit: boolean; hasDocument: boolean
  createdAt: string; verifiedAt: string | null; expiresAt: string | null
  /** Transfers of ownership waiting on this person's identity (the buyer's side). */
  waitingTransfers: number
  /** Whether this row is the latest verification of the person (older rows are history). */
  latest: boolean
  can: { approve: boolean; reject: boolean; revalidate: boolean }
}

export function matchesFilter(r: AdminKycRow, f: KycFilter): boolean {
  switch (f) {
    case 'pending': return r.state === 'PENDING'
    case 'approved': return r.state === 'APPROVED'
    case 'expired': return r.state === 'EXPIRED'
    case 'rejected': return r.state === 'REJECTED'
    case 'pep': return r.pepHit
    default: return true
  }
}

export interface Actor { profile: string }
/** The desk that decides identity: admin and manager (the same desk that approves members). Operators read. */
export const canDecideKyc = (a: Actor) => canApproveMembers(a.profile)

/** Approve: the queue, a rejection the desk reconsiders, or a verification that expired. Only the latest row of the person. */
export const canApprove = (a: Actor, r: { state: KycState; latest: boolean }) => canDecideKyc(a) && r.latest && r.state !== 'APPROVED'
/** Reject: anything not already rejected (an approval withdrawn blocks transfers until a new verification). */
export const canReject = (a: Actor, r: { state: KycState; latest: boolean }) => canDecideKyc(a) && r.latest && r.state !== 'REJECTED'
/** Revalidate: an approval in force expires now, so the person verifies again on the next transfer. */
export const canRevalidate = (a: Actor, r: { state: KycState; latest: boolean }) => canDecideKyc(a) && r.latest && r.state === 'APPROVED'

export function kpisOf(rows: AdminKycRow[]) {
  const latest = rows.filter((r) => r.latest)
  return {
    pending: latest.filter((r) => r.state === 'PENDING').length,
    approved: latest.filter((r) => r.state === 'APPROVED').length,
    expired: latest.filter((r) => r.state === 'EXPIRED').length,
    rejected: latest.filter((r) => r.state === 'REJECTED').length,
    pep: latest.filter((r) => r.pepHit && r.state !== 'REJECTED').length,
    waiting: latest.reduce((n, r) => n + (r.state === 'PENDING' ? r.waitingTransfers : 0), 0),
  }
}
