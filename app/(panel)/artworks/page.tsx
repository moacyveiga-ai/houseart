import Link from 'next/link'
import { requirePanelPage } from '../_session'
import { getArtwork, listArtworks, type ArtworkSummary } from '@/lib/artworks/server'
import { ARTWORK_STATUS_ICONS, ARTWORK_STATUS_LABELS, formatBRL, formatDimensions, LIST_FILTERS } from '@/lib/artworks/domain'
import { Chip } from '@/components/ds/Chip'
import { Icon } from '@/components/ds/Icon'
import { listingsOf } from '@/lib/gallery/listing-server'
import { dealLinesByArtwork } from '@/lib/deals/server'
import { InventoryList } from '@/components/gallery/InventoryList'
import { chipCounts, chipKey, filterInventory, type InventoryItem } from '@/components/gallery/inventory-core'
import { ArtworkPanel } from '@/components/gallery/ArtworkPanel'
import { artworkPanelData } from './_panel-data'
import { SelectableWorks, type SelectableCard } from '@/components/artworks/SelectableWorks'
import { flagOn } from '@/lib/flags'
import { holdsArtwork } from '@/lib/ownership/server'
import { listingOf } from '@/lib/gallery/listing-server'
import { rulesOf } from '@/lib/gallery/rules-server'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'
import type { Scope } from '@/lib/scope/core'

export const metadata = { title: 'Obras — HouseArt' }

/** The work named by ?open= for the side panel (Acervo › obra): display fields only. */
async function panelOf(scope: Scope, id: number, userId: number) {
  const a = await getArtwork(scope, id)
  if (!a) return null
  const listing = a.status === 'LISTED' ? await listingOf(scope, a.id) : null
  const data = await artworkPanelData(a, listing)
  const canManage = sellerPermissions(await galleryRoleOf(scope)).manageListing
  const canTransfer = !!listing && flagOn('FLAG_OWNERSHIP_TRANSFER') && await holdsArtwork(userId, a.id)
  const rules = listing ? await rulesOf(scope).then((r) => ({ refuseBelowBps: r.refuseBelowBps, responseHours: r.responseHours })).catch(() => null) : null
  return { data, canManage, canTransfer, rules, listing: listing ? { listPriceCents: listing.listPriceCents.toString(), acceptsOffers: listing.acceptsOffers, paused: listing.paused, stats: { views7d: listing.stats.views7d, openOffers: listing.stats.openOffers, saves: listing.stats.saves, likes: listing.stats.likes } } : null }
}

/** "Acervo" of the gallery: the whole inventory loaded once, chips and search applied here (listArtworks has no q). */
async function GalleryInventory({ scope, userId, chip, q, openId }: { scope: Scope; userId: number; chip: string; q: string; openId: number | null }) {
  const { items } = await listArtworks(scope, { filter: 'all' })
  const listings = await listingsOf(scope, items.filter((a) => a.status === 'LISTED').map((a) => a.id))
  const deals = await dealLinesByArtwork(scope, items.filter((a) => a.status === 'IN_DEAL' || a.status === 'SOLD').map((a) => a.id))
  const all: InventoryItem[] = []
  items.forEach((a) => {
    const listing = a.status === 'LISTED' ? listings.get(a.id) ?? null : null
    all.push({ id: a.id, title: a.title, year: a.year, artistName: a.artistName, status: a.status, listPriceCents: a.listPriceCents, saleMode: a.saleMode, publicId: a.publicId, coverUrl: a.coverUrl, listing: listing ? { views7d: listing.stats.views7d, openOffers: listing.stats.openOffers, paused: listing.paused, saves: listing.stats.saves } : null, deal: deals.get(a.id) ?? null })
  })
  const base = `/artworks?filter=${chip}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const panel = openId ? await panelOf(scope, openId, userId) : null
  return (
    <>
      <InventoryList title="Acervo" all={all} items={filterInventory(all, chip, q)} chip={chip} q={q} counts={chipCounts(all)} openId={panel ? openId : null} />
      {panel ? <ArtworkPanel key={panel.data.id} a={panel.data} closeHref={base} listing={panel.listing} rules={panel.rules} canManage={panel.canManage} canTransfer={panel.canTransfer} blockedReason={ROLE_REASONS.listing} /> : null}
    </>
  )
}

/** The card of "Minhas obras" as the client island reads it: display strings only (BigInt stays here). */
function cardOf(a: ArtworkSummary): SelectableCard {
  return {
    id: a.id, title: a.title, year: a.year, status: a.status, seal: a.seal, publicId: a.publicId, listPriceCents: a.listPriceCents?.toString() ?? null, coverUrl: a.coverUrl,
    subtitle: [a.technique, formatDimensions(a.dimensions)].filter((x) => x && x !== '—').join(' · ') || '—',
    priceText: a.saleMode === 'ON_REQUEST' ? 'Sob consulta' : formatBRL(a.listPriceCents),
    badge: { tone: a.status === 'AUTHENTICATED' || a.status === 'LISTED' ? 'verified' : a.status === 'IN_CERTIFICATION' ? 'pending' : 'neutral', icon: ARTWORK_STATUS_ICONS[a.status], label: ARTWORK_STATUS_LABELS[a.status] },
  }
}

export default async function ArtworksPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; open?: string }> }) {
  const { scope, nav, user } = await requirePanelPage('/artworks')
  const sp = await searchParams
  const openId = Number(sp.open)
  if (nav === 'gallery' || nav === 'advisor') return <GalleryInventory scope={scope} userId={user.id} chip={chipKey(sp.filter)} q={(sp.q ?? '').slice(0, 80)} openId={Number.isInteger(openId) && openId > 0 ? openId : null} />
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
        filter === 'all' && nav === 'artist' ? (
          <div className="ha-card ha-card--pad ha-stack ha-stack--3">
            <h2 className="ha-h3">Nenhuma obra cadastrada ainda</h2>
            <p className="ha-muted">Comece pela primeira: fotos guiadas, a ficha e, depois, a etiqueta e o certificado.</p>
            <div><Link href="/artworks/new" className="ha-btn ha-btn--primary ha-btn--sm"><Icon name="add_photo_alternate" size={18} />Cadastrar a primeira obra</Link></div>
          </div>
        ) : (
          <div className="ha-card ha-card--pad ha-stack ha-stack--3">
            <p className="ha-muted">{filter === 'all' ? 'Nenhuma obra aqui ainda.' : 'Nenhuma obra neste filtro.'}</p>
            {filter !== 'all' ? <div><Link href="/artworks?filter=all" className="ha-btn ha-btn--ghost ha-btn--sm">Ver todas as obras</Link></div> : null}
          </div>
        )
      ) : (
        // key={filter}: the selection starts over with each chip (the island would otherwise keep ids the new filter no longer shows)
        <SelectableWorks key={filter} items={items.map(cardOf)} markersOn={flagOn('FLAG_CERTIFICATES') && flagOn('FLAG_PHYSICAL_MARKERS') && scope.kind !== 'total'} canList={scope.kind !== 'total'} />
      )}
    </div>
  )
}
