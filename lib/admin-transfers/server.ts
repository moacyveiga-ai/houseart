// Admin › Transferências — I/O: the off-platform transfers (the ones a deal completes are born
// COMPLETED and never wait), who is on each side, what each waits for, and two actions: resend
// the buyer's invite (new token, the old one dies) and cancel with a note (a fee already paid is
// given back through the Stripe door; refused → the audit says refundPending). The buyer's
// document never leaves (mask only, and not even that here).
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { notify } from '@/lib/notifications/server'
import { publicBaseUrl } from '@/lib/public-url'
import { refundOrderPayment } from '@/lib/stripe/door'
import { canCancel, canManageTransfers, canResend, isOpen, isStuck, NOTE_MAX, OPEN_STATUSES, STATUS_LABELS, stepStartOf, WAITING_LABELS, waitingFor, type Actor, type AdminTransferRow } from './core'

const TAKE = 300
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

export async function adminTransfers(actor: Actor, now = new Date()): Promise<AdminTransferRow[]> {
  return totalScope('admin:transfers', async () => {
    const select = { id: true, artworkId: true, fromUserId: true, toUserId: true, toName: true, toEmail: true, priceCents: true, priceSealed: true, royaltyCents: true, feeCents: true, status: true, kycStatus: true, sellerSignedAt: true, buyerSignedAt: true, feePaidAt: true, completedAt: true, createdAt: true, updatedAt: true, artwork: { select: { title: true, publicId: true } } } as const
    // the open ones whole (a stuck one is old by definition); the closed ones are history, the newest TAKE
    const [openRows, closedRows, paidOrders] = await Promise.all([
      prisma.ownershipTransfer.findMany({ where: { dealId: null, status: { in: [...OPEN_STATUSES] } }, orderBy: { id: 'desc' }, take: 1000, select }),
      prisma.ownershipTransfer.findMany({ where: { dealId: null, status: { in: ['COMPLETED', 'CANCELLED'] } }, orderBy: { id: 'desc' }, take: TAKE, select }),
      prisma.order.findMany({ where: { transferId: { not: null }, status: 'PAID', serviceCode: 'OFFPLATFORM_TRANSFER' }, select: { transferId: true } }),
    ])
    const rows = [...openRows, ...closedRows]
    const feeStillPaid = new Set(paidOrders.map((o) => o.transferId as number))
    const sellerIds = [...new Set(rows.map((r) => r.fromUserId))]
    const buyerIds = [...new Set(rows.map((r) => r.toUserId).filter((v): v is number => v !== null))]
    const [sellers, kycs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } }),
      buyerIds.length ? prisma.kycVerification.findMany({ where: { userId: { in: buyerIds } }, orderBy: { id: 'desc' }, select: { userId: true, status: true } }) : [],
    ])
    const sellerOf = new Map(sellers.map((u) => [u.id, u.name]))
    const latestKyc = new Map<number, string>()
    for (const k of kycs) if (!latestKyc.has(k.userId)) latestKyc.set(k.userId, k.status)
    return rows.map((r) => {
      const shape = { status: r.status, kycStatus: r.kycStatus, sellerSignedAt: r.sellerSignedAt?.toISOString() ?? null, buyerSignedAt: r.buyerSignedAt?.toISOString() ?? null, feePaidAt: r.feePaidAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }
      const stepStart = stepStartOf(shape)
      const waiting = waitingFor(shape)
      return {
        ...shape, id: r.id, artworkId: r.artworkId, artworkTitle: r.artwork.title, artworkPublicId: r.artwork.publicId,
        seller: { id: r.fromUserId, name: sellerOf.get(r.fromUserId) ?? `conta ${r.fromUserId}` }, buyer: { id: r.toUserId, name: r.toName, email: r.toEmail },
        priceCents: r.priceSealed ? null : r.priceCents?.toString() ?? null, priceSealed: r.priceSealed, royaltyCents: r.royaltyCents.toString(), feeCents: r.feeCents.toString(),
        statusLabel: STATUS_LABELS[r.status] ?? r.status, waiting, waitingLabel: WAITING_LABELS[waiting], stuck: isStuck(shape, now), daysInStep: Math.floor((now.getTime() - stepStart.getTime()) / 86_400_000),
        feeRefundPending: r.status === 'CANCELLED' && feeStillPaid.has(r.id),
        completedAt: r.completedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(),
        kycWaiting: waiting === 'KYC' && (r.toUserId === null || latestKyc.get(r.toUserId) === 'PENDING'),
        can: { resend: canResend(actor, { ...shape, kycStatus: r.kycStatus }), cancel: canCancel(actor, shape), refund: canManageTransfers(actor) && r.status === 'CANCELLED' && feeStillPaid.has(r.id) },
      }
    })
  })
}

type Ctx = Actor & { userId: number; name: string; ip?: string; userAgent?: string }

async function rowOf(id: number) {
  const t = await prisma.ownershipTransfer.findUnique({ where: { id }, select: { id: true, artworkId: true, dealId: true, fromUserId: true, toUserId: true, toEmail: true, toName: true, status: true, kycStatus: true, buyerSignedAt: true, feePaidAt: true, feePaymentRef: true, artwork: { select: { title: true } } } })
  if (!t || t.dealId !== null) throw new ArtworkError('NOT_FOUND', 'Transferência não encontrada.', 404)
  return t
}

/** A fresh invite to the same buyer e-mail: new token (the previous link stops working), same transfer. */
export async function resendInvite(id: number, actor: Ctx): Promise<{ ok: true }> {
  return totalScope('admin:transfers:resend', async () => {
    const t = await rowOf(id)
    const shape = { status: t.status, buyerSignedAt: t.buyerSignedAt?.toISOString() ?? null, kycStatus: t.kycStatus }
    if (!canResend(actor, shape)) throw new ArtworkError('FORBIDDEN', canResend({ profile: 'admin' }, shape) ? 'Só admin e gestor reenviam o convite.' : t.kycStatus === 'REJECTED' ? 'A identidade do comprador foi reprovada: o caminho é cancelar.' : 'O comprador já respondeu a este convite.', canResend({ profile: 'admin' }, shape) ? 403 : 409)
    const token = randomBytes(24).toString('base64url')
    const w = await prisma.ownershipTransfer.updateMany({ where: { id, status: t.status }, data: { inviteTokenHash: sha(token), inviteIssuedAt: new Date() } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
    // the token only travels by e-mail: never into a Notification row nor a push (rule 3)
    await notify({ userId: null, email: t.toEmail, kind: 'transfer.invite', title: `Transferência de “${t.artwork.title}”`, body: `${publicBaseUrl()}/transfer/${token}`, emailSubject: 'Você foi convidado a receber a titularidade de uma obra' })
    void audit.event({ entity: 'ownership_transfer', entityId: id, action: 'invite_resent', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, after: { status: t.status } })
    return { ok: true }
  })
}

/**
 * The fee goes back by the Stripe door. The truth of "paid" is the PAID order of this transfer
 * (payTransferFee charges BEFORE its CAS: a cancellation in that gap leaves an order without the
 * fee stamp on the transfer), else the stamp itself. Refused → the audit says refundPending and
 * the desk may try again (idempotent by the charge reference).
 */
async function refundFee(t: { id: number; feePaidAt: Date | null; feePaymentRef: string | null }): Promise<{ charged: boolean; refunded: boolean; refundError: string | null }> {
  const order = await prisma.order.findFirst({ where: { transferId: t.id, status: 'PAID', serviceCode: 'OFFPLATFORM_TRANSFER' }, select: { id: true, paymentRef: true } })
  const ref = order?.paymentRef ?? (t.feePaidAt ? t.feePaymentRef : null)
  if (!order && !t.feePaidAt) return { charged: false, refunded: false, refundError: null }
  try {
    await refundOrderPayment(ref ?? '')
    if (order) await prisma.order.updateMany({ where: { id: order.id, status: 'PAID' }, data: { status: 'CANCELLED' } })
    return { charged: true, refunded: true, refundError: null }
  } catch (e) { return { charged: true, refunded: false, refundError: e instanceof Error ? e.name : 'refund_failed' } }
}

/** Cancels an open transfer (note required); a fee already charged goes back through the Stripe door. Both sides are told. */
export async function cancelTransfer(id: number, rawNote: unknown, actor: Ctx): Promise<{ status: 'CANCELLED'; refunded: boolean; refundPending: boolean }> {
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, NOTE_MAX) : ''
  if (!note) throw new ArtworkError('NOTE', 'Diga o motivo do cancelamento.', 422)
  return totalScope('admin:transfers:cancel', async () => {
    const t = await rowOf(id)
    if (!canCancel(actor, t)) throw new ArtworkError('FORBIDDEN', isOpen(t.status) ? 'Só admin e gestor cancelam uma transferência.' : 'Esta transferência já foi encerrada.', isOpen(t.status) ? 403 : 409)
    const w = await prisma.ownershipTransfer.updateMany({ where: { id, status: t.status }, data: { status: 'CANCELLED' } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
    const { charged, refunded, refundError } = await refundFee(t)
    const refundPending = charged && !refunded
    void audit.event({ entity: 'ownership_transfer', entityId: id, action: 'cancel', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { status: t.status }, after: { status: 'CANCELLED', note, feePaid: charged, refunded, refundPending, refundError } })
    const seller = await prisma.user.findUnique({ where: { id: t.fromUserId }, select: { email: true } })
    await notify({ userId: t.fromUserId, email: seller?.email, kind: 'transfer.cancelled', title: `Transferência cancelada · ${t.artwork.title}`, body: charged ? (refunded ? 'A taxa volta pelo mesmo meio de pagamento.' : 'A HouseArt entra em contato sobre a taxa paga.') : 'A HouseArt cancelou esta transferência. Fale com o atendimento se tiver dúvida.', href: '/wallet', emailSubject: 'Sua transferência foi cancelada' })
    await notify({ userId: t.toUserId, email: t.toEmail, kind: 'transfer.cancelled', title: `Transferência cancelada · ${t.artwork.title}`, body: 'O convite deixou de valer.', emailSubject: 'A transferência foi cancelada' })
    return { status: 'CANCELLED', refunded, refundPending }
  })
}

/** "Tentar estornar de novo": a cancelled transfer whose fee is still a PAID order. Idempotent at the gateway. */
export async function retryFeeRefund(id: number, actor: Ctx): Promise<{ refunded: boolean }> {
  return totalScope('admin:transfers:refund', async () => {
    const t = await rowOf(id)
    if (!canManageTransfers(actor)) throw new ArtworkError('FORBIDDEN', 'Só admin e gestor estornam a taxa.', 403)
    if (t.status !== 'CANCELLED') throw new ArtworkError('NOT_CANCELLED', 'Só uma transferência cancelada tem taxa a estornar.', 409)
    const order = await prisma.order.findFirst({ where: { transferId: id, status: 'PAID', serviceCode: 'OFFPLATFORM_TRANSFER' }, select: { id: true } })
    if (!order) throw new ArtworkError('NOTHING_TO_REFUND', 'Não há taxa paga a estornar.', 409)
    const r = await refundFee({ id, feePaidAt: null, feePaymentRef: null })
    void audit.event({ entity: 'ownership_transfer', entityId: id, action: 'refund_retry', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, after: { refunded: r.refunded, refundError: r.refundError } })
    if (!r.refunded) throw new ArtworkError('REFUND_FAILED', 'A Stripe recusou o estorno. Tente mais tarde ou estorne pelo painel da Stripe.', 502)
    return { refunded: true }
  })
}
