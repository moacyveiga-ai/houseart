// Admin › Negócios — I/O: every deal of the house for the desk (newest first), and the manual
// payout: a RELEASED line paid by Pix outside the Stripe becomes PAID here, with a note, so it
// leaves "A receber" of the seller and the payouts to do of the house. The team only (total scope).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { formatBRL } from '@/lib/artworks/domain'
import { dataBR } from '@/lib/timezone'
import { SPLIT_PARTY_LABELS } from '@/lib/commission/split-core'
import { MANUAL_PAYOUT_PREFIX, payeeMemberOf, splitPayoutState, type ConnectAccountStatus } from '@/lib/stripe/connect-core'
import { stripeMode } from '@/lib/stripe/door'
import { payeeAccountOf } from '@/lib/stripe/connect-server'
import { canMarkPaid, escrowOf, isPhase, MANUAL_NOTE_MAX, payoutLabelOf, PHASE_LABELS, type AdminDealRow } from './core'

const TAKE = 300

export async function adminDeals(): Promise<AdminDealRow[]> {
  return totalScope('admin:deals', async () => {
    const deals = await prisma.deal.findMany({
      orderBy: { createdAt: 'desc' }, take: TAKE,
      select: {
        id: true, code: true, phase: true, exceptionStatus: true, market: true, amountCents: true, shippingCents: true, insuranceCents: true,
        escrowPaidAt: true, escrowMethod: true, escrowPendingRef: true, escrowExpiresAt: true, createdAt: true, completedAt: true, sellerMemberId: true, tenantId: true, buyerUserId: true,
        artwork: { select: { id: true, title: true, artist: { select: { name: true, memberId: true } }, member: { select: { kind: true, displayName: true } } } },
        splits: { select: { id: true, party: true, amountCents: true, status: true, payoutError: true, payoutRef: true }, orderBy: { id: 'asc' } },
      },
    })
    const buyerIds = [...new Set(deals.map((d) => d.buyerUserId))]
    const buyers = new Map((await prisma.user.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    const payeeIds = new Set<number>()
    for (const d of deals) {
      const ctx = { sellerMemberId: d.sellerMemberId, sellerKind: d.artwork.member.kind, artistMemberId: d.artwork.artist.memberId }
      for (const s of d.splits) { const m = payeeMemberOf(s.party, ctx); if (m !== null) payeeIds.add(m) }
    }
    const mode = stripeMode()
    const accounts = new Map((await prisma.stripeConnectAccount.findMany({ where: { memberId: { in: [...payeeIds] }, mode }, select: { memberId: true, status: true } })).map((a) => [a.memberId, a.status as ConnectAccountStatus]))
    const members = new Map((await prisma.member.findMany({ where: { id: { in: [...payeeIds] } }, select: { id: true, displayName: true } })).map((m) => [m.id, m.displayName]))
    // the gallery's line can be paid by the ENABLED account of an ADMIN of the tenant (the same rule as the cron, payeeAccountOf)
    const galleryTenants = [...new Set(deals.filter((d) => d.artwork.member.kind === 'GALLERY_STAFF' && d.tenantId !== null).map((d) => d.tenantId as number))]
    const admins = galleryTenants.length ? await prisma.member.findMany({ where: { tenantId: { in: galleryTenants }, kind: 'GALLERY_STAFF', status: 'ACTIVE', OR: [{ role: 'ADMIN' }, { user: { tenantRole: 'ADMIN' } }] }, select: { id: true, tenantId: true } }) : []
    const enabledAdmins = new Set((await prisma.stripeConnectAccount.findMany({ where: { memberId: { in: admins.map((a) => a.id) }, mode, status: 'ENABLED' }, select: { memberId: true } })).map((a) => a.memberId))
    const tenantPays = new Set(admins.filter((a) => enabledAdmins.has(a.id)).map((a) => a.tenantId))
    const fmt = (iso: string) => dataBR(iso)
    return deals.map((d) => {
      const ctx = { sellerMemberId: d.sellerMemberId, sellerKind: d.artwork.member.kind, artistMemberId: d.artwork.artist.memberId }
      const phase = isPhase(d.phase) ? d.phase : 'OFFER_ACCEPTED'
      return {
        id: d.id, code: d.code, phase, phaseLabel: PHASE_LABELS[phase], exception: d.exceptionStatus,
        artworkTitle: d.artwork.title, artworkId: d.artwork.id, artist: d.artwork.artist.name, seller: d.artwork.member.displayName, sellerKind: d.artwork.member.kind, buyer: buyers.get(d.buyerUserId) ?? `comprador ${d.buyerUserId}`,
        market: d.market, amountCents: d.amountCents.toString(), totalCents: (d.amountCents + d.shippingCents + d.insuranceCents).toString(),
        escrow: escrowOf({ escrowPaidAt: d.escrowPaidAt?.toISOString() ?? null, escrowMethod: d.escrowMethod, escrowPendingRef: d.escrowPendingRef, escrowExpiresAt: d.escrowExpiresAt?.toISOString() ?? null }, fmt),
        splits: d.splits.map((s) => {
          const payeeId = payeeMemberOf(s.party, ctx)
          const own = payeeId === null ? null : accounts.get(payeeId) ?? null
          const byAdmin = own !== 'ENABLED' && s.party === 'GALLERY' && d.artwork.member.kind === 'GALLERY_STAFF' && d.tenantId !== null && tenantPays.has(d.tenantId)
          const state = splitPayoutState(s, byAdmin ? 'ENABLED' : own)
          return { id: s.id, party: s.party, label: SPLIT_PARTY_LABELS[s.party as keyof typeof SPLIT_PARTY_LABELS] ?? s.party, amountCents: s.amountCents.toString(), status: s.status, payoutState: state, payoutLabel: payoutLabelOf(state, s.payoutRef), payoutError: s.payoutError, payee: payeeId === null ? null : members.get(payeeId) ?? null, stripePays: s.status === 'RELEASED' && (own === 'ENABLED' || byAdmin) }
        }),
        createdAt: d.createdAt.toISOString(), completedAt: d.completedAt?.toISOString() ?? null,
      }
    })
  })
}

/**
 * The desk paid a released line by hand (Pix outside the Stripe): the line becomes PAID with the
 * note as the reference. Only a line the desk can mark (released, not Stripe-transferred); the
 * artist's royalty line also settles its RoyaltyPayment, as the Stripe transfer does.
 */
export async function markSplitPaidManually(dealId: number, splitId: number, rawNote: unknown, actor: { userId: number; name: string; ip?: string; userAgent?: string }): Promise<{ amount: string }> {
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, MANUAL_NOTE_MAX) : ''
  if (!note) throw new ArtworkError('NOTE', 'Diga como foi pago (ex.: Pix 12/10, comprovante nº …).', 422)
  return totalScope('admin:deals:manual-payout', async () => {
    const s = await prisma.dealSplit.findFirst({ where: { id: splitId, dealId }, select: { id: true, party: true, amountCents: true, status: true, payoutError: true, deal: { select: { phase: true, exceptionStatus: true, sellerMemberId: true, tenantId: true, artwork: { select: { member: { select: { kind: true } }, artist: { select: { memberId: true } } } } } } } })
    if (!s) throw new ArtworkError('NOT_FOUND', 'Linha do repasse não encontrada.', 404)
    if (s.deal.phase !== 'COMPLETED') throw new ArtworkError('WRONG_PHASE', 'O repasse sai depois que o negócio é concluído.', 409)
    if (s.deal.exceptionStatus) throw new ArtworkError('WRONG_PHASE', s.deal.exceptionStatus === 'CANCELLED' ? 'Negócio cancelado: nada a repassar.' : 'Negócio em disputa: o repasse espera a decisão.', 409)
    const ctx = { sellerMemberId: s.deal.sellerMemberId, sellerKind: s.deal.artwork.member.kind, artistMemberId: s.deal.artwork.artist.memberId }
    const payeeId = payeeMemberOf(s.party, ctx)
    const mode = stripeMode()
    const account = payeeId === null ? null : await prisma.stripeConnectAccount.findFirst({ where: { memberId: payeeId, mode }, select: { status: true } })
    // the same resolution the cron uses (own account, or the gallery ADMIN's): a line the Stripe pays alone is never paid by hand
    const stripePays = (await payeeAccountOf(s, { ...ctx, tenantId: s.deal.tenantId }, mode)) !== null
    const state = splitPayoutState(s, stripePays ? 'ENABLED' : account?.status as ConnectAccountStatus | undefined ?? null)
    if (stripePays) throw new ArtworkError('STRIPE_PAYS', 'Quem recebe tem a conta Stripe ativa: o repasse sai pela Stripe (Tentar de novo).', 409)
    if (!canMarkPaid({ status: s.status, party: s.party, payoutState: state, stripePays })) throw new ArtworkError('NOT_MANUAL', 'Esta linha não espera repasse manual.', 409)
    const r = await prisma.dealSplit.updateMany({ where: { id: s.id, status: 'RELEASED' }, data: { status: 'PAID', payoutRef: `${MANUAL_PAYOUT_PREFIX}${note}`, transferredAt: new Date(), payoutError: null } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'A linha acabou de mudar.', 409)
    if (s.party === 'ARTIST_ROYALTY') await prisma.royaltyPayment.updateMany({ where: { dealId, status: { in: ['PENDING', 'HELD'] } }, data: { status: 'PAID', paidAt: new Date(), receiptRef: `${MANUAL_PAYOUT_PREFIX}${note}` } })
    void audit.event({ entity: 'deal', entityId: dealId, action: 'split_paid_manually', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, after: { splitId: s.id, party: s.party, amountCents: s.amountCents.toString() } })
    return { amount: formatBRL(s.amountCents) }
  })
}
