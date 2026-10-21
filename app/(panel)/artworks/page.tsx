import Link from 'next/link'
import { requirePanelPage } from '../_session'
import { listArtworks } from '@/lib/artworks/server'
import { ARTWORK_STATUS_ICONS, ARTWORK_STATUS_LABELS, formatBRL, formatDimensions, LIST_FILTERS } from '@/lib/artworks/domain'
import { Chip } from '@/components/ds/Chip'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'

export const metadata = { title: 'Minhas obras — HouseArt' }

export default async function ArtworksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { scope, nav } = await requirePanelPage('/artworks')
  const filter = (await searchParams).filter ?? 'all'
  const { items, counts } = await listArtworks(scope, { filter })
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <h1 className="ha-h1">{nav === 'artist' ? 'Minhas obras' : 'Inventário'}</h1>
        <Link href="/artworks/new" className="ha-btn ha-btn--primary ha-btn--md"><Icon name="add" size={18} />Nova obra</Link>
      </div>
      <div className="ha-row" role="group" aria-label="Filtros">
        {LIST_FILTERS.map((f) => <Chip key={f.key} on={f.key === filter} href={`/artworks?filter=${f.key}`}>{f.name} <span className="ha-chip__n">{counts[f.key] ?? 0}</span></Chip>)}
      </div>
      {items.length === 0 ? (
        <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma obra aqui ainda.</p></div>
      ) : (
        <div className="ha-grid-cards">
          {items.map((a) => (
            <Link key={a.id} href={`/artworks/${a.id}/edit`} className="ha-card">
              <span className="ha-wall ha-wall--sq">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                  {a.coverUrl ? <img src={a.coverUrl} alt={a.title} /> : <Icon name="imagesmode" size={28} />}</span>
              <div className="ha-card__body">
                <div className="ha-title">{a.title}{a.year ? `, ${a.year}` : ''}</div>
                <div className="ha-muted ha-sm">{[a.technique, formatDimensions(a.dimensions)].filter((x) => x && x !== '—').join(' · ') || '—'}</div>
                <div className="ha-row">
                  <Badge tone={a.status === 'AUTHENTICATED' || a.status === 'LISTED' ? 'verified' : a.status === 'IN_CERTIFICATION' ? 'pending' : 'neutral'}>
                    <Icon name={ARTWORK_STATUS_ICONS[a.status]} size={14} /> {ARTWORK_STATUS_LABELS[a.status]}
                  </Badge>
                  <span className="ha-num">{a.saleMode === 'ON_REQUEST' ? 'Sob consulta' : formatBRL(a.listPriceCents)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
