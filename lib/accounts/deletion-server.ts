// Excluir minha conta — I/O. Blocked while the person is in a negotiation (as buyer or seller); otherwise the
// account is closed at once (inactive, every session ended, request stamped for the team's legal follow-up).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { deletionBlocker, typedOk, type OpenNegotiations } from './deletion-core'

const OPEN_OFFER = ['AWAITING_OTP', 'RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING', 'ACCEPTED', 'IN_DEAL']
const OPEN_TRANSFER = ['INVITED', 'KYC_PENDING', 'SELLER_SIGNED', 'BUYER_SIGNED', 'SIGNED', 'FEE_PAID', 'AWAITING_TAP']

/** Open negotiations of the person on either side: offers, deals not finished nor cancelled, transfers. */
export async function openNegotiations(userId: number): Promise<OpenNegotiations> {
  return totalScope('account:delete-check', async () => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true } })
    const asSeller = u?.memberId != null ? [{ memberId: u.memberId }] : []
    const [offers, deals, transfers] = await Promise.all([
      prisma.offer.count({ where: { status: { in: OPEN_OFFER }, OR: [{ buyerUserId: userId }, ...asSeller] } }),
      // a deal in dispute is still open; only a cancelled one is over
      prisma.deal.count({ where: { phase: { not: 'COMPLETED' }, AND: [{ OR: [{ exceptionStatus: null }, { exceptionStatus: 'DISPUTE' }] }, { OR: [{ buyerUserId: userId }, ...(u?.memberId != null ? [{ sellerMemberId: u.memberId }] : [])] }] } }),
      prisma.ownershipTransfer.count({ where: { status: { in: OPEN_TRANSFER }, OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
    ])
    return { offers, deals, transfers }
  })
}

export async function requestAccountDeletion(userId: number, typed: unknown, ctx: { ip?: string; userAgent?: string } = {}): Promise<void> {
  if (!typedOk(typed)) throw new ArtworkError('CONFIRM', 'Digite EXCLUIR para confirmar.', 422)
  const blocker = deletionBlocker(await openNegotiations(userId))
  if (blocker) throw new ArtworkError('IN_NEGOTIATION', blocker, 409)
  const u = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({ where: { id: userId }, data: { active: false, deletionRequestedAt: new Date() }, select: { id: true, name: true } })
    await tx.session.deleteMany({ where: { userId } })
    return row
  })
  void audit.event({ entity: 'user', entityId: u.id, action: 'account_deletion_requested', userId: u.id, userName: u.name, ip: ctx.ip, userAgent: ctx.userAgent, after: { active: false } })
}
