import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { flagOn } from '@/lib/flags'
import { adminMarkersView, listOrdersForStaff } from '@/lib/physical-markers/server'
import { Kpis } from '@/components/ds/Kpi'
import { MarkersAdmin } from '@/components/admin/MarkersAdmin'

export const metadata = { title: 'Etiquetas — HouseArt' }

export default async function AdminMarkersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user } = await requirePanelPage('/admin/markers')
  if (!hasTotalScope(user) || !flagOn('FLAG_PHYSICAL_MARKERS')) notFound()
  const q = (await searchParams).q ?? ''
  const [view, orders] = await Promise.all([adminMarkersView(q), listOrdersForStaff()])
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Etiquetas</h1></div>
      <Kpis items={[
        { label: 'Em estoque', value: view.kpis.stock.toLocaleString('pt-BR') },
        { label: 'Vinculadas', value: view.kpis.linked.toLocaleString('pt-BR') },
        { label: 'Alertas de remoção', value: String(view.kpis.removedToday), note: 'últimas 24 h' },
      ]} />
      <MarkersAdmin batches={view.batches} found={view.found} query={q} orders={orders.map((o) => ({ id: o.id, quantity: o.quantity, status: o.status, memberId: o.memberId, createdAt: o.createdAt.toISOString() }))} />
    </div>
  )
}
