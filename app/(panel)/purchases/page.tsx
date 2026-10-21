import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { buyerDeals } from '@/lib/deals/server'
import { DealTimeline, serializeDeal } from '@/components/deals/DealTimeline'

export const metadata = { title: 'Compras — HouseArt' }

export default async function PurchasesPage() {
  const { user } = await requirePanelPage('/purchases')
  if (!flagOn('FLAG_DEALS')) notFound()
  const deals = await buyerDeals(user.id)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Compras</h1></div>
      {deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma compra em andamento.</p></div> : deals.map((d) => <DealTimeline key={d.id} deal={serializeDeal(d)} side="buyer" />)}
    </div>
  )
}
