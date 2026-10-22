// The web offer in five steps (handoff "HouseArt Oferta"): own bar, stepper,
// the artwork aside. Server Component: loads the public artwork and, when
// logged, the viewer's identity checks; the island does the rest.
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import '@/components/offers/offer-wizard.css'
import { OfferBar, type OfferArtwork } from '@/components/offers/OfferFrame'
import { OfferWizard } from '@/components/offers/OfferWizard'
import { getSession } from '@/lib/auth'
import { identityOf } from '@/lib/accounts/identity-server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicArtwork } from '@/lib/marketplace/public-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Fazer oferta — HouseArt', robots: { index: false, follow: false } }

export default async function OfferPage({ params }: { params: Promise<{ publicId: string }> }) {
  const publicId = (await params).publicId.toUpperCase()
  if (!isPublicId(publicId)) notFound()
  const a = await publicArtwork(publicId)
  if (!a) notFound()
  // Only a listed work with a price takes offers; a fixed-price-only one goes to the purchase.
  if (!a.acceptsOffers || a.priceCents === null) redirect(a.fixedPrice && a.priceCents !== null ? `/e/artwork/${publicId}/buy` : `/e/artwork/${publicId}`)
  const user = await getSession()
  const identity = user ? await identityOf(user.id) : null
  const artwork: OfferArtwork = {
    publicId, title: a.title, year: a.year, artist: a.artist, technique: a.technique, dimensions: a.dimensions, cover: a.cover,
    certified: a.certificateStatus === 'ACTIVE', seller: { name: a.seller.name, kind: a.seller.kind }, priceCents: Number(a.priceCents),
  }
  return (
    <>
      <OfferBar backHref={`/e/artwork/${publicId}`} />
      <OfferWizard artwork={artwork} viewer={user ? { name: user.name, email: user.email, cpf: user.cpf } : null} identity={identity} />
    </>
  )
}
