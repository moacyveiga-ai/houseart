import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { reviewQueue, REVIEW_KIND_LABELS } from '@/lib/admin-review/server'
import { Kpis } from '@/components/ds/Kpi'
import { ReviewQueue } from '@/components/admin/ReviewQueue'

export const metadata = { title: 'Obras e certificados — HouseArt' }

export default async function AdminReviewPage() {
  const { user } = await requirePanelPage('/admin/review')
  if (!hasTotalScope(user)) notFound()
  const q = await reviewQueue()
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Obras e certificados</h1></div>
      <Kpis items={[
        { label: 'Obras certificadas', value: String(q.kpis.certified) },
        { label: 'Na fila de revisão', value: String(q.kpis.open) },
        { label: 'Contestações abertas', value: String(q.kpis.contested) },
      ]} />
      <h2 className="ha-h3">Fila de revisão</h2>
      <ReviewQueue items={q.items.map((i) => ({ ...i, kindLabel: REVIEW_KIND_LABELS[i.kind], createdAt: i.createdAt.toISOString() }))} />
    </div>
  )
}
