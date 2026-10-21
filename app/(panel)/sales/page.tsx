import { requirePanelPage } from '../_session'
import { negotiatorOf, sellerOffers } from '@/lib/offers/server'
import { negotiatorLabel } from '@/lib/offers/mandate-core'
import { Tabs } from '@/components/ds/Tabs'
import { OffersTable } from '@/components/offers/OffersTable'
import { sellerDeals } from '@/lib/deals/server'
import { DealTimeline, serializeDeal } from '@/components/deals/DealTimeline'
import { flagOn } from '@/lib/flags'

export const metadata = { title: 'Vendas e ofertas — HouseArt' }

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { scope } = await requirePanelPage('/sales')
  const tab = (await searchParams).tab === 'deals' ? 'deals' : 'offers'
  const offers = await sellerOffers(scope)
  const deals = tab === 'deals' && flagOn('FLAG_DEALS') ? await sellerDeals(scope) : []
  const mandate = await negotiatorOf(scope)
  const open = offers.filter((o) => o.open).length
  const live = flagOn('FLAG_DEALS') ? (await sellerDeals(scope)).filter((d) => d.phase !== 'COMPLETED').length : offers.filter((o) => o.status === 'ACCEPTED' || o.status === 'IN_DEAL').length
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Vendas e ofertas</h1></div>
      <Tabs active={tab} items={[{ key: 'offers', label: 'Ofertas recebidas', href: '/sales', count: open }, { key: 'deals', label: 'Em andamento', href: '/sales?tab=deals', count: live }]} />
      {tab === 'offers' ? (
        <OffersTable negotiatorLine={mandate ? negotiatorLabel(mandate) : 'Negociador automático: nenhuma obra listada.'} offers={offers.map((o) => ({
          id: o.id, code: o.code, artworkTitle: o.artworkTitle, artworkCover: o.artworkCover, listPriceCents: o.listPriceCents?.toString() ?? null, currentCents: o.currentCents.toString(),
          status: o.status, statusLabel: o.statusLabel, buyer: o.buyer, expiresIn: o.expiresIn, differenceLabel: o.differenceLabel, open: o.open, lastAuthor: o.rounds[o.rounds.length - 1]?.author ?? null,
        }))} />
      ) : (
        deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma venda em andamento.</p></div> : deals.map((d) => <DealTimeline key={d.id} deal={serializeDeal(d)} side="seller" />)
      )}
    </div>
  )
}
