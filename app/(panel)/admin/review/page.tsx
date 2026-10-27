import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { reviewQueue } from '@/lib/admin-review/server'
import { REVIEW_FILTER_LABELS, REVIEW_FILTERS, REVIEW_KIND_LABELS, REVIEW_KINDS, reviewFilterKey, reviewHref, reviewKindKey } from '@/lib/admin-review/core'
import { Kpis } from '@/components/ds/Kpi'
import { Chip } from '@/components/ds/Chip'
import { ReviewQueue } from '@/components/admin/ReviewQueue'
import { Tabs } from '@/components/ds/Tabs'

export const metadata = { title: 'Obras e certificados — HouseArt' }

export default async function AdminReviewPage({ searchParams }: { searchParams: Promise<{ f?: string; kind?: string }> }) {
  const { user } = await requirePanelPage('/admin/review')
  if (!hasTotalScope(user)) notFound()
  const sp = await searchParams
  const filter = reviewFilterKey(sp.f)
  const kind = reviewKindKey(sp.kind)
  const q = await reviewQueue(new Date(), { filter, kind, userId: user.id })
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Obras e certificados</h1></div>
      <Tabs active="queue" items={[{ key: 'queue', label: 'Fila de revisão', href: '/admin/review', count: q.kpis.open }, { key: 'artworks', label: 'Todas as obras', href: '/admin/review/artworks' }]} />
      <Kpis items={[
        { label: 'Obras certificadas', value: q.kpis.certified.toLocaleString('pt-BR'), note: q.kpis.certifiedNote },
        { label: 'Na fila de revisão', value: String(q.kpis.open), note: q.kpis.openNote },
        { label: 'Contestações abertas', value: String(q.kpis.contested), note: q.kpis.contestedNote },
      ]} />
      <h2 className="ha-h3">Fila de revisão</h2>
      {/* audit 2026-10-25 §5: history and filters — the decided ones no longer vanish on reload */}
      <div className="ha-row" role="group" aria-label="Filtro">
        {REVIEW_FILTERS.map((f) => <Chip key={f} on={f === filter} href={reviewHref(f, kind)}>{REVIEW_FILTER_LABELS[f]}</Chip>)}
      </div>
      <div className="ha-row" role="group" aria-label="Tipo">
        <Chip on={kind === null} href={reviewHref(filter, null)}>Todos os tipos</Chip>
        {REVIEW_KINDS.map((k) => <Chip key={k} on={k === kind} href={reviewHref(filter, k)}>{REVIEW_KIND_LABELS[k]}</Chip>)}
      </div>
      <ReviewQueue key={`${filter}:${kind ?? ''}`} readOnly={filter !== 'open'} items={q.items.map((i) => ({ id: i.id, kind: i.kind, reason: i.reason, ago: i.ago, artwork: i.artwork, decided: i.decided }))} />
    </div>
  )
}
