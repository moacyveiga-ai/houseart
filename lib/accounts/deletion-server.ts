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

/** Open negotiations of the person on either side: offers (also made before login, by e-mail), deals not
 *  finished nor cancelled, transfers (also an invite by e-mail) and their own artworks on sale. */
export async function openNegotiations(userId: number): Promise<OpenNegotiations> {
  return totalScope('account:delete-check', async () => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true, email: true } })
    const asSeller = u?.memberId != null ? [{ memberId: u.memberId }] : []
    const email = u?.email ? [{ buyerEmail: u.email }] : []
    const [offers, deals, transfers, listings] = await Promise.all([
      prisma.offer.count({ where: { status: { in: OPEN_OFFER }, OR: [{ buyerUserId: userId }, ...email, ...asSeller] } }),
      // a deal in dispute is still open; only a cancelled one is over
      prisma.deal.count({ where: { phase: { not: 'COMPLETED' }, AND: [{ OR: [{ exceptionStatus: null }, { exceptionStatus: 'DISPUTE' }] }, { OR: [{ buyerUserId: userId }, ...(u?.memberId != null ? [{ sellerMemberId: u.memberId }] : [])] }] } }),
      prisma.ownershipTransfer.count({ where: { status: { in: OPEN_TRANSFER }, OR: [{ fromUserId: userId }, { toUserId: userId }, ...(u?.email ? [{ toEmail: u.email }] : [])] } }),
      u?.memberId != null ? prisma.artwork.count({ where: { memberId: u.memberId, status: { in: ['LISTED', 'IN_DEAL'] } } }) : 0,
    ])
    return { offers, deals, transfers, listings }
  })
}

/** Who may close the account here: a collector. Artists, galleries and the team close theirs with support
 *  (tenants, listings, payouts and the team's own access go with them). */
export const SELF_DELETE_PROFILES = ['collector'] as const

export async function requestAccountDeletion(userId: number, typed: unknown, ctx: { ip?: string; userAgent?: string } = {}): Promise<void> {
  if (!typedOk(typed)) throw new ArtworkError('CONFIRM', 'Digite EXCLUIR para confirmar.', 422)
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profile: true, tenantRole: true, member: { select: { kind: true } } } })
  const collector = me?.profile === 'collector' && (!me.member || me.member.kind === 'COLLECTOR')
  if (!collector) throw new ArtworkError('NOT_SELF_SERVICE', 'A exclusão de conta de artista, galeria ou equipe é feita pelo atendimento da HouseArt.', 403)
  const blocker = deletionBlocker(await openNegotiations(userId))
  if (blocker) throw new ArtworkError('IN_NEGOTIATION', blocker, 409)
  const u = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({ where: { id: userId }, data: { active: false, deletionRequestedAt: new Date() }, select: { id: true, name: true } })
    // every way back in or out: sessions (cookie and app bearer) and the push subscriptions (web and Expo)
    await tx.session.deleteMany({ where: { userId } })
    await tx.pushSubscription.deleteMany({ where: { userId } })
    return row
  })
  void audit.event({ entity: 'user', entityId: u.id, action: 'account_deletion_requested', userId: u.id, userName: u.name, ip: ctx.ip, userAgent: ctx.userAgent, after: { active: false } })
}
