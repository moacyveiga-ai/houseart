// Offer projections — the ONLY shapes that leave lib/offers. The seller's
// view never carries the buyer's document or e-mail; the buyer's view never
// carries the seller's envelope; neither carries the floor (leak.test.ts).
import { buyerLabel, differencePct, expiresLabel, formatDifference, OFFER_STATUS_LABELS, type OfferStatus } from './domain'
import { buyerFacingStatus } from './state'

export interface OfferRow {
  id: number; code: string; artworkId: number; artworkTitle: string; artworkCover: string | null; listPriceCents: bigint | null
  offeredCents: bigint; currentCents: bigint; status: OfferStatus; statusLabel: string; buyer: string; expiresIn: string; differenceLabel: string
  open: boolean; rounds: { number: number; author: string; amountCents: bigint; message: string | null; at: string }[]
  createdAt: string
}

type Row = {
  id: number; code: string; artworkId: number; offeredCents: bigint; acceptedCents: bigint | null; status: string; expiresAt: Date; createdAt: Date
  buyerKind: string; buyerCity: string | null; buyerName: string; buyerUserId: number | null
  artwork: { title: string; year: number | null; listPriceCents: bigint | null; media: { publicUrl: string | null }[] }
  rounds: { number: number; author: string; amountCents: bigint; message: string | null; createdAt: Date }[]
}

export function toSellerRow(o: Row, now: Date): OfferRow {
  const last = o.rounds[o.rounds.length - 1]
  const currentCents = o.acceptedCents ?? last?.amountCents ?? o.offeredCents
  const status = o.status as OfferStatus
  const pct = o.artwork.listPriceCents ? differencePct(currentCents, o.artwork.listPriceCents) : 0
  return {
    id: o.id, code: o.code, artworkId: o.artworkId, artworkTitle: `${o.artwork.title}${o.artwork.year ? `, ${o.artwork.year}` : ''}`,
    artworkCover: o.artwork.media[0]?.publicUrl ?? null, listPriceCents: o.artwork.listPriceCents, offeredCents: o.offeredCents, currentCents,
    status, statusLabel: OFFER_STATUS_LABELS[status], buyer: buyerLabel({ buyerKind: o.buyerKind, buyerCity: o.buyerCity, buyerName: o.buyerName, buyerVerified: !!o.buyerUserId }),
    expiresIn: expiresLabel(o.expiresAt, now), differenceLabel: formatDifference(pct),
    open: status === 'RECEIVED' || status === 'BELOW_RESERVE' || status === 'NEGOTIATING',
    rounds: o.rounds.map((r) => ({ number: r.number, author: r.author, amountCents: r.amountCents, message: r.message, at: r.createdAt.toISOString() })),
    createdAt: o.createdAt.toISOString(),
  }
}

export interface BuyerOffer {
  code: string; artworkTitle: string; offeredCents: bigint; currentCents: bigint; status: OfferStatus; statusLabel: string; expiresAt: string
  rounds: { number: number; author: string; amountCents: bigint; message: string | null; at: string }[]
  canRetract: boolean; canReply: boolean
}

export function toBuyerView(o: Row & { retractionIssuedAt: Date | null }, now: Date): BuyerOffer {
  const status = buyerFacingStatus(o.status as OfferStatus)
  const last = o.rounds[o.rounds.length - 1]
  const retractOpen = ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'].includes(o.status) && now.getTime() - o.createdAt.getTime() <= 24 * 3_600_000
  return {
    code: o.code, artworkTitle: `${o.artwork.title}${o.artwork.year ? `, ${o.artwork.year}` : ''}`, offeredCents: o.offeredCents, currentCents: o.acceptedCents ?? last?.amountCents ?? o.offeredCents,
    status, statusLabel: OFFER_STATUS_LABELS[status], expiresAt: o.expiresAt.toISOString(),
    rounds: o.rounds.map((r) => ({ number: r.number, author: r.author, amountCents: r.amountCents, message: r.message, at: r.createdAt.toISOString() })),
    canRetract: retractOpen, canReply: o.status === 'NEGOTIATING' && last?.author !== 'BUYER',
  }
}
