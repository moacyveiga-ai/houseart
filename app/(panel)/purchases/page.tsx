import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { buyerDeals } from '@/lib/deals/server'
import { DealTimeline } from '@/components/deals/DealTimeline'
import { serializeDeal } from '@/components/deals/deal-view'
import Link from 'next/link'
import { offersOfUser } from '@/lib/offers/server'
import { formatBRL } from '@/lib/artworks/domain'
import { collectionSummary } from '@/lib/collector-wallet/collection-server'
import { CollectionHeader } from '@/components/collector/CollectionHeader'

export const metadata = { title: 'Compras — HouseArt' }

export default async function PurchasesPage() {
  const { user, nav } = await requirePanelPage('/purchases')
  if (!flagOn('FLAG_DEALS')) notFound()
  const [deals, offers, summary] = await Promise.all([buyerDeals(user.id), offersOfUser(user.id), nav === 'collector' ? collectionSummary(user) : null])
  // The buyer's own proposals (audit 2026-10-25: they existed only in the mobile app). Converted ones live in the deal below.
  const live = offers.filter((o) => o.status !== 'CONVERTED' && o.status !== 'IN_DEAL')
  return (
    <div className="ha-page">
      {summary ? <CollectionHeader s={summary} active="purchases" /> : <div className="ha-page__head"><div><h1 className="ha-h1">Compras</h1><p className="ha-muted ha-sm">Acompanhe cada compra até a escritura em seu nome.</p></div></div>}
      {live.length ? (
        <section className="ha-stack">
          <h2 className="ha-h3">Suas ofertas</h2>
          <ul className="ha-list">
            {live.map((o) => (
              <li key={o.code}>
                <Link href={`/e/offer/${o.code}`} className="ha-list__row" style={{ gridTemplateColumns: '40px minmax(0,1fr) auto auto' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
                  <span className="ha-wall ha-wall--40">{o.artworkCover ? <img src={o.artworkCover} alt="" /> : null}</span>
                  <span><i style={{ fontFamily: 'var(--ha-font-display)' }}>{o.artworkTitle}</i><br /><span className="ha-muted ha-sm">{o.artistName ?? ''}{o.artistName ? ' · ' : ''}{o.code}</span></span>
                  <span className="ha-num">{formatBRL(o.currentCents)}</span>
                  <span className="ha-badge">{o.canReply ? 'Contraproposta para você' : o.statusLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma compra em andamento. Quando um vendedor aceitar uma oferta sua, a compra aparece aqui até a escritura em seu nome.</p></div> : deals.map((d) => <DealTimeline key={d.id} deal={serializeDeal(d)} side="buyer" />)}
    </div>
  )
}
