// The props of the buyer's offer screen (OfferSent), shared by the public page /e/offer/[code]
// (one-time token of the e-mail) and the panel page /purchases/offer/[code] (the logged buyer).
import type { OfferArtwork } from '@/components/offers/OfferFrame'
import type { StatusOffer } from '@/components/offers/offer-status-core'
import { buyerOffer } from '@/lib/offers/server'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { formatCep } from '@/lib/shipping/quote-core'

export interface OfferPageData { code: string; offer: StatusOffer; artwork: OfferArtwork; deliveryCep: string | null; artworkPublicId: string | null; artworkId: number | null }

export async function offerPageData(code: string, access: Parameters<typeof buyerOffer>[1]): Promise<OfferPageData | null> {
  const o = await buyerOffer(code, access)
  if (!o) return null
  const a = o.artworkPublicId ? await publicArtwork(o.artworkPublicId) : null
  const [title, year] = (() => { const m = /^(.*), (\d{4})$/.exec(o.artworkTitle); return m ? [m[1], Number(m[2])] : [o.artworkTitle, null] })()
  const artwork: OfferArtwork = {
    publicId: o.artworkPublicId ?? '', title: a?.title ?? title, year: a?.year ?? year, artist: a?.artist ?? o.artistName ?? '', technique: a?.technique ?? null, dimensions: a?.dimensions ?? '—',
    cover: a?.cover ?? o.artworkCover, certified: a ? a.certificateStatus === 'ACTIVE' : true,
    seller: a ? { name: a.seller.name, kind: a.seller.kind } : { name: 'Vendedor', kind: 'PRIVATE' }, priceCents: Number(o.listPriceCents ?? o.offeredCents),
  }
  const offer: StatusOffer = {
    status: o.status, canReply: o.canReply, canRetract: o.canRetract, validityHours: o.validityHours,
    offeredCents: Number(o.offeredCents), currentCents: Number(o.currentCents), listPriceCents: o.listPriceCents === null ? null : Number(o.listPriceCents),
    rounds: o.rounds.map((r) => ({ number: r.number, author: r.author, amountCents: Number(r.amountCents), message: r.message, at: r.at })),
    createdAt: o.createdAt, expiresAt: o.expiresAt, counterCents: o.counterCents === null ? null : Number(o.counterCents), counterMessage: o.counterMessage,
    guaranteeMethod: o.guaranteeMethod, shippingCents: Number(o.shippingCents), insuranceCents: Number(o.insuranceCents),
  }
  return { code: o.code, offer, artwork, deliveryCep: o.deliveryCep ? formatCep(o.deliveryCep) : null, artworkPublicId: o.artworkPublicId, artworkId: a?.id ?? null }
}
