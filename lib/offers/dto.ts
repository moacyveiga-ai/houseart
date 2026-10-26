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
  /** the buyer for the offer card (gallery and collector desks): first name, initials, whether the account is verified */
  buyerFirstName: string; buyerInitials: string; buyerVerified: boolean
  /** share of the asking price, integer % (null without a price) */
  pctOfPrice: number | null
  /** the buyer's own words: the message of the last buyer round */
  buyerMessage: string | null
}

type Row = {
  id: number; code: string; artworkId: number; offeredCents: bigint; acceptedCents: bigint | null; status: string; expiresAt: Date; createdAt: Date
  buyerKind: string; buyerCity: string | null; buyerName: string; buyerUserId: number | null
  artwork: { title: string; year: number | null; listPriceCents: bigint | null; media: { publicUrl: string | null }[]; publicId?: string | null; artist?: { name: string } | null }
  rounds: { number: number; author: string; amountCents: bigint; message: string | null; createdAt: Date }[]
  // Phase 4 (optional for the seller's row; the buyer's view reads them)
  validityHours?: number; guaranteeMethod?: string; shippingCents?: bigint; insuranceCents?: bigint; deliveryCep?: string | null; message?: string | null
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
    buyerFirstName: o.buyerName.trim().split(/\s+/)[0] ?? o.buyerName,
    buyerInitials: o.buyerName.trim().split(/\s+/).filter(Boolean).map((w, i, a) => (i === 0 || i === a.length - 1 ? w[0] : '')).join('').toUpperCase().slice(0, 2),
    buyerVerified: !!o.buyerUserId,
    pctOfPrice: o.artwork.listPriceCents && o.artwork.listPriceCents > 0n ? Number((currentCents * 100n) / o.artwork.listPriceCents) : null,
    buyerMessage: [...o.rounds].reverse().find((r) => r.author === 'BUYER' && r.message)?.message ?? null,
  }
}

export interface BuyerOffer {
  code: string; artworkTitle: string; artworkPublicId: string | null; artistName: string | null; artworkCover: string | null; listPriceCents: bigint | null
  offeredCents: bigint; currentCents: bigint; status: OfferStatus; statusLabel: string; expiresAt: string; createdAt: string
  rounds: { number: number; author: string; amountCents: bigint; message: string | null; at: string }[]
  canRetract: boolean; canReply: boolean
  /** Phase 4: what the buyer chose at the offer; the quote frozen then */
  validityHours: number; guaranteeMethod: string; shippingCents: bigint; insuranceCents: bigint; deliveryCep: string | null; message: string | null
  /** the seller's last counter, when the ball is with the buyer */
  counterCents: bigint | null; counterMessage: string | null
}

export function toBuyerView(o: Row & { retractionIssuedAt: Date | null }, now: Date): BuyerOffer {
  const status = buyerFacingStatus(o.status as OfferStatus)
  const last = o.rounds[o.rounds.length - 1]
  const retractOpen = ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'].includes(o.status) && now.getTime() - o.createdAt.getTime() <= 24 * 3_600_000
  const canReply = o.status === 'NEGOTIATING' && last?.author !== 'BUYER'
  return {
    code: o.code, artworkTitle: `${o.artwork.title}${o.artwork.year ? `, ${o.artwork.year}` : ''}`, artworkPublicId: o.artwork.publicId ?? null, artistName: o.artwork.artist?.name ?? null,
    artworkCover: o.artwork.media[0]?.publicUrl ?? null, listPriceCents: o.artwork.listPriceCents,
    offeredCents: o.offeredCents, currentCents: o.acceptedCents ?? last?.amountCents ?? o.offeredCents,
    status, statusLabel: OFFER_STATUS_LABELS[status], expiresAt: o.expiresAt.toISOString(), createdAt: o.createdAt.toISOString(),
    rounds: o.rounds.map((r) => ({ number: r.number, author: r.author, amountCents: r.amountCents, message: r.message, at: r.createdAt.toISOString() })),
    canRetract: retractOpen, canReply,
    validityHours: o.validityHours ?? 168, guaranteeMethod: o.guaranteeMethod ?? 'NONE', shippingCents: o.shippingCents ?? 0n, insuranceCents: o.insuranceCents ?? 0n, deliveryCep: o.deliveryCep ?? null, message: o.message ?? null,
    counterCents: canReply && last ? last.amountCents : null, counterMessage: canReply && last ? last.message : null,
  }
}
