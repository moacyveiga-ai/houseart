// Carteira e cartões › saldos e Movimentações: reads the person's purchases, released offer holds and
// the split lines owed to their member (lib/payment-methods/ledger-core.ts decides). Read-only.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { payeeMemberOf } from '@/lib/stripe/connect-core'
import { balanceNotes, walletBalances, walletMovements, type Movement, type PurchaseFact, type ReleasedHoldFact, type SaleLineFact } from './ledger-core'
import { formatBRL } from '@/lib/artworks/domain'

export interface WalletLedgerView { escrow: { amount: string; note: string }; receivable: { amount: string; note: string } | null; movements: Movement[] }

const TAKE = 60

export async function walletLedger(userId: number, memberId: number | null): Promise<WalletLedgerView> {
  return totalScope('wallet:ledger', async () => {
    const [deals, offers, sold] = await Promise.all([
      prisma.deal.findMany({ where: { buyerUserId: userId, escrowPaidAt: { not: null } }, orderBy: { escrowPaidAt: 'desc' }, take: TAKE, select: { id: true, code: true, amountCents: true, shippingCents: true, insuranceCents: true, escrowPaidAt: true, completedAt: true, exceptionStatus: true, artwork: { select: { title: true } } } }),
      prisma.offer.findMany({ where: { buyerUserId: userId, guaranteeStatus: 'CANCELLED' }, orderBy: { updatedAt: 'desc' }, take: TAKE, select: { id: true, code: true, offeredCents: true, updatedAt: true, artwork: { select: { title: true } } } }),
      memberId == null ? Promise.resolve([]) : prisma.deal.findMany({
        where: { escrowPaidAt: { not: null }, OR: [{ sellerMemberId: memberId }, { artwork: { artist: { memberId } } }] },
        orderBy: { escrowPaidAt: 'desc' }, take: TAKE,
        select: { id: true, code: true, sellerMemberId: true, exceptionStatus: true, artwork: { select: { title: true, artist: { select: { memberId: true } } } }, splits: { select: { id: true, party: true, amountCents: true, status: true, transferredAt: true } } },
      }),
    ])
    const purchases: PurchaseFact[] = deals.map((d) => ({ id: d.id, code: d.code, title: d.artwork.title, totalCents: d.amountCents + d.shippingCents + d.insuranceCents, paidAt: d.escrowPaidAt, completedAt: d.completedAt, cancelled: d.exceptionStatus === 'CANCELLED' }))
    const holds: ReleasedHoldFact[] = offers.map((o) => ({ id: o.id, code: o.code, title: o.artwork.title, amountCents: o.offeredCents, at: o.updatedAt }))
    const lines: SaleLineFact[] = sold.flatMap((d) => {
      const artistMemberId = d.artwork.artist.memberId
      // The seller's own share is named ARTIST when the artist sells, GALLERY otherwise (computeSplit).
      const ctx = { sellerMemberId: d.sellerMemberId, sellerKind: artistMemberId === d.sellerMemberId ? 'ARTIST' : 'OTHER', artistMemberId }
      return d.splits.filter((s) => payeeMemberOf(s.party, ctx) === memberId).map((s) => ({ id: s.id, dealId: d.id, dealCode: d.code, title: d.artwork.title, amountCents: s.amountCents, status: s.status, buyerPaid: true, transferredAt: s.transferredAt, cancelled: d.exceptionStatus === 'CANCELLED' }))
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
