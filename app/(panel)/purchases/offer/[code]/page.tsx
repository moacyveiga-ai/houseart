// "Sua oferta" inside the panel (audit colecionador §81: after sending, the buyer stays in the
// logged shell, not on the public site): the same OfferSent of /e/offer/[code], read by the session.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import '@/components/offers/offer-wizard.css'
import { OfferSent } from '@/components/offers/OfferSent'
import { Icon } from '@/components/ds/Icon'
import { requirePanelPage } from '../../../_session'
import { offerPageData } from '@/app/e/_shared/offer-page'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sua oferta — HouseArt', robots: { index: false, follow: false } }

export default async function PanelOfferPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  const { user } = await requirePanelPage(`/purchases/offer/${code}`)
  const d = await offerPageData(code, { userId: user.id })
  if (!d) notFound()
  return (
    <div className="ha-page">
      <div className="ha-page__head"><Link href="/purchases" className="ha-btn ha-btn--ghost ha-btn--sm"><Icon name="arrow_back" size={18} />Compras</Link></div>
      <OfferSent code={d.code} offer={d.offer} artwork={d.artwork} token={null} deliveryCep={d.deliveryCep} talkArtworkId={d.artworkId} />
    </div>
  )
}
