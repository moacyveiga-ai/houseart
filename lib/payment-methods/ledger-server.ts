// Carteira e cartões › saldos e Movimentações: reads the person's purchases, released offer holds and
// the split lines owed to their member (lib/payment-methods/ledger-core.ts decides). Read-only.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { payeeMemberOf } from '@/lib/stripe/connect-core'
import { balanceNotes, escrowChargedCents, walletBalances, walletMovements, type Movement, type PurchaseFact, type ReleasedHoldFact, type SaleLineFact } from './ledger-core'
import { formatBRL } from '@/lib/artworks/domain'

export interface WalletLedgerView { escrow: { amount: string; note: string }; receivable: { amount: string; note: string } | null; movements: Movement[] }

const TAKE = 60

export async function walletLedger(userId: number, memberId: number | null): Promise<WalletLedgerView> {
  return totalScope('wallet:ledger', async () => {
    const dealSelect = { id: true, code: true, amountCents: true, shippingCents: true, insuranceCents: true, escrowPaymentRef: true, escrowPaidAt: true, completedAt: true, exceptionStatus: true, offer: { select: { guaranteeRef: true } }, artwork: { select: { title: true } } } as const
    const soldSelect = { id: true, code: true, sellerMemberId: true, exceptionStatus: true, artwork: { select: { title: true, artist: { select: { memberId: true } } } }, splits: { select: { id: true, party: true, amountCents: true, status: true, transferredAt: true } } } as const
    const mine = memberId == null ? null : { escrowPaidAt: { not: null }, OR: [{ sellerMemberId: memberId }, { artwork: { artist: { memberId } } }] }
    const [open, done, offers, owed, paid] = await Promise.all([
      // balances read every deal in course (no cut); the movements read the most recent ones
      prisma.deal.findMany({ where: { buyerUserId: userId, escrowPaidAt: { not: null }, completedAt: null, exceptionStatus: null }, select: dealSelect }),
      prisma.deal.findMany({ where: { buyerUserId: userId, completedAt: { not: null }, NOT: { exceptionStatus: 'CANCELLED' } }, orderBy: { completedAt: 'desc' }, take: TAKE, select: dealSelect }),
      prisma.offer.findMany({ where: { buyerUserId: userId, guaranteeStatus: 'CANCELLED' }, orderBy: { updatedAt: 'desc' }, take: TAKE, select: { id: true, code: true, offeredCents: true, updatedAt: true, artwork: { select: { title: true } } } }),
      mine == null ? Promise.resolve([]) : prisma.deal.findMany({ where: { ...mine, NOT: { exceptionStatus: 'CANCELLED' }, splits: { some: { status: { in: ['HELD', 'RELEASED'] } } } }, select: soldSelect }),
      mine == null ? Promise.resolve([]) : prisma.deal.findMany({ where: { ...mine, splits: { some: { status: 'PAID' } } }, orderBy: { updatedAt: 'desc' }, take: TAKE, select: soldSelect }),
    ])
    const purchases: PurchaseFact[] = [...open, ...done].map((d) => ({ id: d.id, code: d.code, title: d.artwork.title, totalCents: escrowChargedCents({ ...d, offerHoldRef: d.offer.guaranteeRef }), paidAt: d.escrowPaidAt, completedAt: d.completedAt, cancelled: d.exceptionStatus === 'CANCELLED' }))
    const holds: ReleasedHoldFact[] = offers.map((o) => ({ id: o.id, code: o.code, title: o.artwork.title, amountCents: o.offeredCents, at: o.updatedAt }))
    const sold = [...new Map([...owed, ...paid].map((d) => [d.id, d])).values()]
    const sellerKinds = new Map((await prisma.member.findMany({ where: { id: { in: [...new Set(sold.map((d) => d.sellerMemberId))] } }, select: { id: true, kind: true } })).map((m) => [m.id, m.kind]))
    const lines: SaleLineFact[] = sold.flatMap((d) => {
      const artistMemberId = d.artwork.artist.memberId
      // The gallery's share of a sale listed by its staff belongs to the gallery, not to the staffer
      // who listed it (it is paid to the gallery's admin account): it stays out of a person's wallet.
      const gallerySale = sellerKinds.get(d.sellerMemberId) === 'GALLERY_STAFF'
      // The seller's own share is named ARTIST when the artist sells, GALLERY otherwise (computeSplit).
      const ctx = { sellerMemberId: d.sellerMemberId, sellerKind: artistMemberId === d.sellerMemberId ? 'ARTIST' : 'OTHER', artistMemberId }
      return d.splits.filter((s) => !(gallerySale && s.party === 'GALLERY') && payeeMemberOf(s.party, ctx) === memberId).map((s) => ({ id: s.id, dealId: d.id, dealCode: d.code, title: d.artwork.title, amountCents: s.amountCents, status: s.status, buyerPaid: true, transferredAt: s.transferredAt, cancelled: d.exceptionStatus === 'CANCELLED' }))
    })
    const b = walletBalances(purchases, lines)
    const notes = balanceNotes(b)
    return {
      escrow: { amount: formatBRL(b.inEscrowCents), note: notes.escrow },
      receivable: memberId == null ? null : { amount: formatBRL(b.receivableCents), note: notes.receivable },
      movements: walletMovements(purchases, holds, lines),
    }
  })
}
