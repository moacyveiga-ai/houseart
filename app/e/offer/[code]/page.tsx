// The buyer's page of one offer — the "Enviada" step of the handoff (HouseArt
// Oferta): status, the seller's counter, the timeline and the artwork aside.
// Opened by the one-time token of the e-mail (?t=) or by the logged buyer;
// never indexed.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '@/components/offers/offer-wizard.css'
import { OfferBar, type OfferArtwork } from '@/components/offers/OfferFrame'
import { OfferSent } from '@/components/offers/OfferSent'
import type { StatusOffer } from '@/components/offers/offer-status-core'
import { getSession } from '@/lib/auth'
import { buyerOffer } from '@/lib/offers/server'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { formatCep } from '@/lib/shipping/quote-core'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sua oferta — HouseArt', robots: { index: false, follow: false } }

export default async function BuyerOfferPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const code = (await params).code.toUpperCase()
  const token = (await searchParams).t ?? null
  const session = token ? null : await getSession()
  const o = await buyerOffer(code, token ?? (session ? { userId: session.id } : null))
  if (!o) notFound()
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
  return (
    <>
      <OfferBar backHref={o.artworkPublicId ? `/e/artwork/${o.artworkPublicId}` : '/e/marketplace'} backLabel={o.artworkPublicId ? 'Voltar à obra' : 'Marketplace'} />
      <OfferSent code={o.code} offer={offer} artwork={artwork} token={token} deliveryCep={o.deliveryCep ? formatCep(o.deliveryCep) : null} talkArtworkId={session && a ? a.id : null} />
    </>
  )
}
