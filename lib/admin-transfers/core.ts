// Admin › Transferências — pure rules (audit 2026-10-25, web-app §5: "transferências fora da
// plataforma travadas: falta toque, taxa paga"). What each off-platform transfer waits for,
// which ones are stuck, the filters, the KPIs and what the desk may do: resend the buyer's
// invite, cancel with a note. The tap of the marker is never the desk's to supply (rule 10).
import { canApproveMembers } from '@/lib/auth/profiles'

export const TRANSFER_FILTERS = ['open', 'stuck', 'kyc', 'tap', 'completed', 'cancelled', 'all'] as const
export type TransferFilter = (typeof TRANSFER_FILTERS)[number]
export const TRANSFER_FILTER_LABELS: Record<TransferFilter, string> = { open: 'Em curso', stuck: 'Travadas', kyc: 'Esperando KYC', tap: 'Esperando o toque', completed: 'Concluídas', cancelled: 'Canceladas', all: 'Todas' }
export const filterKey = (raw: string | undefined): TransferFilter => (TRANSFER_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as TransferFilter) : 'open'

export const OPEN_STATUSES = ['INVITED', 'KYC_PENDING', 'SELLER_SIGNED', 'BUYER_SIGNED', 'SIGNED', 'FEE_PAID', 'AWAITING_TAP'] as const
export const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status)

export type WaitingFor = 'BUYER_ACCEPT' | 'KYC' | 'KYC_REJECTED' | 'BUYER_SIGNATURE' | 'SELLER_SIGNATURE' | 'FEE' | 'TAP' | 'DONE' | 'CANCELLED'
export const WAITING_LABELS: Record<WaitingFor, string> = {
  BUYER_ACCEPT: 'comprador abrir o convite', KYC: 'identidade do comprador (KYC)', KYC_REJECTED: 'identidade reprovada — cancelar ou pedir nova verificação', BUYER_SIGNATURE: 'assinatura do comprador', SELLER_SIGNATURE: 'assinatura do vendedor',
  FEE: 'taxa do vendedor', TAP: 'toque do comprador na etiqueta', DONE: 'concluída', CANCELLED: 'cancelada',
}
/** Open for this long in the same step reads "travada". */
export const STUCK_DAYS = 7
export const NOTE_MAX = 200

export interface Actor { profile: string }
export const canManageTransfers = (a: Actor) => canApproveMembers(a.profile)

export interface TransferShape { status: string; kycStatus: string | null; sellerSignedAt: string | null; buyerSignedAt: string | null; feePaidAt: string | null; createdAt: string }

/** What the transfer waits for now, from its status and the two signatures (the status alone lags: KYC approved by the desk keeps KYC_PENDING until the buyer signs). */
export function waitingFor(t: TransferShape): WaitingFor {
  if (t.status === 'COMPLETED') return 'DONE'
  if (t.status === 'CANCELLED') return 'CANCELLED'
  if (t.status === 'AWAITING_TAP') return 'TAP'
  if (t.status === 'SIGNED' || t.status === 'FEE_PAID') return 'FEE'
  if (t.status === 'KYC_PENDING' && t.kycStatus === 'REJECTED') return 'KYC_REJECTED'
  if (t.status === 'KYC_PENDING' && t.kycStatus !== 'APPROVED') return 'KYC'
  if (!t.buyerSignedAt && !t.sellerSignedAt) return 'BUYER_ACCEPT'
  if (!t.buyerSignedAt) return 'BUYER_SIGNATURE'
  return 'SELLER_SIGNATURE'
}

/** When the current step began: the latest stamp of the steps (never `updatedAt`, which a resent invite or a stray write would reset). */
export function stepStartOf(t: Pick<TransferShape, 'createdAt' | 'sellerSignedAt' | 'buyerSignedAt' | 'feePaidAt'>): Date {
  const stamps = [t.createdAt, t.sellerSignedAt, t.buyerSignedAt, t.feePaidAt].filter((v): v is string => !!v).map((v) => new Date(v).getTime())
  return new Date(Math.max(...stamps))
}

export function isStuck(t: TransferShape, now: Date): boolean {
  return isOpen(t.status) && now.getTime() - stepStartOf(t).getTime() > STUCK_DAYS * 86_400_000
}

export interface AdminTransferRow extends TransferShape {
  id: number; artworkId: number; artworkTitle: string; artworkPublicId: string | null
  seller: { id: number; name: string }; buyer: { id: number | null; name: string; email: string }
  priceCents: string | null; priceSealed: boolean; royaltyCents: string; feeCents: string
  statusLabel: string; waiting: WaitingFor; waitingLabel: string; stuck: boolean; daysInStep: number
  completedAt: string | null; updatedAt: string
  /** Cancelled with the fee still a PAID order: the refund did not go through (the desk may retry). */
  feeRefundPending: boolean
  /** The buyer's KYC verification waits for the desk (link to /admin/kyc). */
  kycWaiting: boolean
  can: { resend: boolean; cancel: boolean; refund: boolean }
}

export const STATUS_LABELS: Record<string, string> = { DRAFT: 'Rascunho', INVITED: 'Convidada', KYC_PENDING: 'KYC pendente', SELLER_SIGNED: 'Vendedor assinou', BUYER_SIGNED: 'Comprador assinou', SIGNED: 'Assinada', FEE_PAID: 'Taxa paga', AWAITING_TAP: 'Aguardando toque', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' }

/** The invite can be sent again while the buyer has not signed — never to a buyer the desk rejected (the way out is cancelling). */
export const canResend = (a: Actor, t: Pick<TransferShape, 'status' | 'buyerSignedAt' | 'kycStatus'>) => canManageTransfers(a) && isOpen(t.status) && !t.buyerSignedAt && t.kycStatus !== 'REJECTED'
export const canCancel = (a: Actor, t: Pick<TransferShape, 'status'>) => canManageTransfers(a) && isOpen(t.status)

export function matchesFilter(r: Pick<AdminTransferRow, 'status' | 'stuck' | 'waiting'>, f: TransferFilter): boolean {
  switch (f) {
    case 'open': return isOpen(r.status)
    case 'stuck': return r.stuck
    case 'kyc': return r.waiting === 'KYC'
    case 'tap': return r.waiting === 'TAP'
    case 'completed': return r.status === 'COMPLETED'
    case 'cancelled': return r.status === 'CANCELLED'
    case 'all': return true
  }
}

export function kpisOf(rows: Pick<AdminTransferRow, 'status' | 'stuck' | 'waiting' | 'feePaidAt'>[]) {
  const open = rows.filter((r) => isOpen(r.status))
  return {
    open: open.length,
    stuck: open.filter((r) => r.stuck).length,
    kyc: open.filter((r) => r.waiting === 'KYC').length,
    tap: open.filter((r) => r.waiting === 'TAP').length,
    feePaidOpen: open.filter((r) => !!r.feePaidAt).length,
    completed: rows.filter((r) => r.status === 'COMPLETED').length,
  }
}
