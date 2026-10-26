import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { flagOn } from '@/lib/flags'
import { adminMarkersView, listOrdersForStaff } from '@/lib/physical-markers/server'
import { Kpis } from '@/components/ds/Kpi'
import { Icon } from '@/components/ds/Icon'
import { MarkersAdmin } from '@/components/admin/MarkersAdmin'

export const metadata = { title: 'Etiquetas — HouseArt' }

export default async function AdminMarkersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user } = await requirePanelPage('/admin/markers')
  if (!hasTotalScope(user) || !flagOn('FLAG_PHYSICAL_MARKERS')) notFound()
  const q = (await searchParams).q ?? ''
  const [view, orders] = await Promise.all([adminMarkersView(q), listOrdersForStaff()])
  const k = view.kpis
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <h1 className="ha-h1">Etiquetas</h1>
        <form className="ha-markers__search" role="search" method="get">
          <Icon name="search" size={20} />
          <input name="q" className="ha-topbar__input" placeholder="UID da etiqueta ou ID da obra" aria-label="UID da etiqueta ou ID da obra" defaultValue={q} />
        </form>
      </div>
      <Kpis items={[
        { label: 'Em estoque', value: k.stock.toLocaleString('pt-BR'), note: k.newBatches ? `${k.newBatches} ${k.newBatches === 1 ? 'lote novo' : 'lotes novos'}` : 'nenhum lote novo' },
        { label: 'Vinculadas', value: k.linked.toLocaleString('pt-BR'), note: k.linkedShare === null ? 'nenhuma enviada ainda' : `${k.linkedShare.toLocaleString('pt-BR')}% das enviadas` },
        { label: 'Alertas de remoção', value: String(k.removedToday), note: k.removedToday ? 'nas últimas 24 h · lista abaixo' : 'nenhum nas últimas 24 h' },
      ]} />
      <MarkersAdmin batches={view.batches} found={view.found} query={q} alerts={view.alerts} orders={orders.map((o) => ({ id: o.id, quantity: o.quantity, status: o.status, who: o.who, createdAt: o.createdAt.toISOString() }))} />
    </div>
  )
}
