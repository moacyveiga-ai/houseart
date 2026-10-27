// The buyer's page of one offer — the "Enviada" step of the handoff (HouseArt
// Oferta): status, the seller's counter, the timeline and the artwork aside.
// Opened by the one-time token of the e-mail (?t=); the LOGGED buyer is sent to
// the same screen inside the panel (/purchases/offer/[code], audit 2026-10-25).
// Never indexed.
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import '@/components/offers/offer-wizard.css'
import { OfferBar } from '@/components/offers/OfferFrame'
import { OfferSent } from '@/components/offers/OfferSent'
import { getSession } from '@/lib/auth'
import { panelSession } from '@/lib/auth/panel'
import { offerPageData } from '../../_shared/offer-page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sua oferta — HouseArt', robots: { index: false, follow: false } }

export default async function BuyerOfferPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const code = (await params).code.toUpperCase()
  const token = (await searchParams).t ?? null
  const session = token ? null : await getSession()
  const d = await offerPageData(code, token ?? (session ? { userId: session.id } : null))
  if (!d) notFound()
  // only an account that opens the panel goes there (an institution would bounce back to /e)
  if (session && (await panelSession())) redirect(`/purchases/offer/${d.code}`)
  return (
    <>
      <OfferBar backHref={d.artworkPublicId ? `/e/artwork/${d.artworkPublicId}` : '/e/marketplace'} backLabel={d.artworkPublicId ? 'Voltar à obra' : 'Marketplace'} />
      <OfferSent code={d.code} offer={d.offer} artwork={d.artwork} token={token} deliveryCep={d.deliveryCep} talkArtworkId={session ? d.artworkId : null} />
    </>
  )
}
