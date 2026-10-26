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
import { canCancel, canResend, isOpen, isStuck, NOTE_MAX, STATUS_LABELS, WAITING_LABELS, waitingFor, type Actor, type AdminTransferRow } from './core'

const TAKE = 300
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

export async function adminTransfers(actor: Actor, now = new Date()): Promise<AdminTransferRow[]> {
  return totalScope('admin:transfers', async () => {
    const rows = await prisma.ownershipTransfer.findMany({
      where: { dealId: null }, orderBy: { id: 'desc' }, take: TAKE,
      select: { id: true, artworkId: true, fromUserId: true, toUserId: true, toName: true, toEmail: true, priceCents: true, priceSealed: true, royaltyCents: true, feeCents: true, status: true, kycStatus: true, sellerSignedAt: true, buyerSignedAt: true, feePaidAt: true, completedAt: true, createdAt: true, updatedAt: true, artwork: { select: { title: true, publicId: true } } },
    })
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
      const shape = { status: r.status, kycStatus: r.kycStatus, sellerSignedAt: r.sellerSignedAt?.toISOString() ?? null, buyerSignedAt: r.buyerSignedAt?.toISOString() ?? null, feePaidAt: r.feePaidAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString() }
      const waiting = waitingFor(shape)
      return {
        ...shape, id: r.id, artworkId: r.artworkId, artworkTitle: r.artwork.title, artworkPublicId: r.artwork.publicId,
        seller: { id: r.fromUserId, name: sellerOf.get(r.fromUserId) ?? `conta ${r.fromUserId}` }, buyer: { id: r.toUserId, name: r.toName, email: r.toEmail },
        priceCents: r.priceSealed ? null : r.priceCents?.toString() ?? null, priceSealed: r.priceSealed, royaltyCents: r.royaltyCents.toString(), feeCents: r.feeCents.toString(),
        statusLabel: STATUS_LABELS[r.status] ?? r.status, waiting, waitingLabel: WAITING_LABELS[waiting], stuck: isStuck(shape, now), daysInStep: Math.floor((now.getTime() - r.updatedAt.getTime()) / 86_400_000),
        createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null,
        kycWaiting: waiting === 'KYC' && (r.toUserId === null || latestKyc.get(r.toUserId) === 'PENDING'),
        can: { resend: canResend(actor, shape), cancel: canCancel(actor, shape) },
      }
    })
  })
}

type Ctx = Actor & { userId: number; name: string; ip?: string; userAgent?: string }

async function rowOf(id: number) {
  const t = await prisma.ownershipTransfer.findUnique({ where: { id }, select: { id: true, artworkId: true, dealId: true, fromUserId: true, toUserId: true, toEmail: true, toName: true, status: true, buyerSignedAt: true, feePaidAt: true, feePaymentRef: true, artwork: { select: { title: true } } } })
  if (!t || t.dealId !== null) throw new ArtworkError('NOT_FOUND', 'Transferência não encontrada.', 404)
  return t
}

/** A fresh invite to the same buyer e-mail: new token (the previous link stops working), same transfer. */
export async function resendInvite(id: number, actor: Ctx): Promise<{ ok: true }> {
  return totalScope('admin:transfers:resend', async () => {
    const t = await rowOf(id)
    if (!canResend(actor, { status: t.status, buyerSignedAt: t.buyerSignedAt?.toISOString() ?? null })) throw new ArtworkError('FORBIDDEN', isOpen(t.status) && !t.buyerSignedAt ? 'Só admin e gestor reenviam o convite.' : 'O comprador já respondeu a este convite.', isOpen(t.status) && !t.buyerSignedAt ? 403 : 409)
    const token = randomBytes(24).toString('base64url')
    const w = await prisma.ownershipTransfer.updateMany({ where: { id, status: t.status }, data: { inviteTokenHash: sha(token), inviteIssuedAt: new Date() } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
    await notify({ userId: t.toUserId, email: t.toEmail, kind: 'transfer.invite', title: `Transferência de “${t.artwork.title}”`, body: `${publicBaseUrl()}/transfer/${token}`, emailSubject: 'Você foi convidado a receber a titularidade de uma obra' })
    void audit.event({ entity: 'ownership_transfer', entityId: id, action: 'invite_resent', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, after: { status: t.status } })
    return { ok: true }
  })
}

/** Cancels an open transfer (note required); a fee already paid goes back through the Stripe door. Both sides are told. */
export async function cancelTransfer(id: number, rawNote: unknown, actor: Ctx): Promise<{ status: 'CANCELLED'; refunded: boolean; refundPending: boolean }> {
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, NOTE_MAX) : ''
  if (!note) throw new ArtworkError('NOTE', 'Diga o motivo do cancelamento.', 422)
  return totalScope('admin:transfers:cancel', async () => {
    const t = await rowOf(id)
    if (!canCancel(actor, t)) throw new ArtworkError('FORBIDDEN', isOpen(t.status) ? 'Só admin e gestor cancelam uma transferência.' : 'Esta transferência já foi encerrada.', isOpen(t.status) ? 403 : 409)
    const w = await prisma.ownershipTransfer.updateMany({ where: { id, status: t.status }, data: { status: 'CANCELLED' } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
    let refunded = false, refundError: string | null = null
    if (t.feePaidAt && t.feePaymentRef) {
      try {
        await refundOrderPayment(t.feePaymentRef)
        await prisma.order.updateMany({ where: { transferId: id, status: 'PAID' }, data: { status: 'CANCELLED' } })
        refunded = true
      } catch (e) { refundError = e instanceof Error ? e.name : 'refund_failed' }
    }
    const refundPending = !!t.feePaidAt && !refunded
    void audit.event({ entity: 'ownership_transfer', entityId: id, action: 'cancel', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { status: t.status }, after: { status: 'CANCELLED', note, feePaid: !!t.feePaidAt, refunded, refundPending, refundError } })
    const seller = await prisma.user.findUnique({ where: { id: t.fromUserId }, select: { email: true } })
    await notify({ userId: t.fromUserId, email: seller?.email, kind: 'transfer.cancelled', title: `Transferência cancelada · ${t.artwork.title}`, body: t.feePaidAt ? (refunded ? 'A taxa volta pelo mesmo meio de pagamento.' : 'A HouseArt entra em contato sobre a taxa paga.') : 'A HouseArt cancelou esta transferência. Fale com o atendimento se tiver dúvida.', href: '/wallet', emailSubject: 'Sua transferência foi cancelada' })
    await notify({ userId: t.toUserId, email: t.toEmail, kind: 'transfer.cancelled', title: `Transferência cancelada · ${t.artwork.title}`, body: 'O convite deixou de valer.', emailSubject: 'A transferência foi cancelada' })
    return { status: 'CANCELLED', refunded, refundPending }
  })
}
