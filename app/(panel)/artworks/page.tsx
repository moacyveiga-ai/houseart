import Link from 'next/link'
import { requirePanelPage } from '../_session'
import { listArtworks } from '@/lib/artworks/server'
import { ARTWORK_STATUS_ICONS, ARTWORK_STATUS_LABELS, formatBRL, formatDimensions, LIST_FILTERS } from '@/lib/artworks/domain'
import { Chip } from '@/components/ds/Chip'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'
import { listingsOf } from '@/lib/gallery/listing-server'
import { InventoryList } from '@/components/gallery/InventoryList'
import { chipCounts, chipKey, filterInventory, type InventoryItem } from '@/components/gallery/inventory-core'

export const metadata = { title: 'Obras — HouseArt' }

/** "Acervo" of the gallery: the whole inventory loaded once, chips and search applied here (listArtworks has no q). */
async function GalleryInventory({ scope, chip, q }: { scope: Parameters<typeof listArtworks>[0]; chip: string; q: string }) {
  const { items } = await listArtworks(scope, { filter: 'all' })
  const listings = await listingsOf(scope, items.filter((a) => a.status === 'LISTED').map((a) => a.id))
  const all: InventoryItem[] = []
  items.forEach((a) => {
    const listing = a.status === 'LISTED' ? listings.get(a.id) ?? null : null
    all.push({ id: a.id, title: a.title, year: a.year, artistName: a.artistName, status: a.status, listPriceCents: a.listPriceCents, saleMode: a.saleMode, publicId: a.publicId, coverUrl: a.coverUrl, listing: listing ? { views7d: listing.stats.views7d, openOffers: listing.stats.openOffers, paused: listing.paused } : null })
  })
  return <InventoryList title="Acervo" all={all} items={filterInventory(all, chip, q)} chip={chip} q={q} counts={chipCounts(all)} />
}

export default async function ArtworksPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { scope, nav } = await requirePanelPage('/artworks')
  const sp = await searchParams
  if (nav === 'gallery' || nav === 'advisor') return <GalleryInventory scope={scope} chip={chipKey(sp.filter)} q={(sp.q ?? '').slice(0, 80)} />
  const filter = sp.filter ?? 'all'
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
