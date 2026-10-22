import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { buyerDeals } from '@/lib/deals/server'
import { DealTimeline } from '@/components/deals/DealTimeline'
import { serializeDeal } from '@/components/deals/deal-view'

export const metadata = { title: 'Compras — HouseArt' }

export default async function PurchasesPage() {
  const { user } = await requirePanelPage('/purchases')
  if (!flagOn('FLAG_DEALS')) notFound()
  const deals = await buyerDeals(user.id)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><div><h1 className="ha-h1">Compras</h1><p className="ha-muted ha-sm">Acompanhe cada compra até a escritura em seu nome.</p></div></div>
      {deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma compra em andamento.</p></div> : deals.map((d) => <DealTimeline key={d.id} deal={serializeDeal(d)} side="buyer" />)}
    </div>
  )
}
