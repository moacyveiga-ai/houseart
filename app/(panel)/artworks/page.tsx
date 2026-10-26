import Link from 'next/link'
import { requirePanelPage } from '../_session'
import { getArtwork, listArtworks, type ArtworkSummary } from '@/lib/artworks/server'
import { categoryLabel, ARTWORK_STATUS_ICONS, ARTWORK_STATUS_LABELS, formatBRL, formatDimensions, LIST_FILTERS, MEDIA_SLOTS, type ArtworkStatus } from '@/lib/artworks/domain'
import { Chip } from '@/components/ds/Chip'
import { Icon } from '@/components/ds/Icon'
import { listingsOf } from '@/lib/gallery/listing-server'
import { dealLinesByArtwork } from '@/lib/deals/server'
import { InventoryList } from '@/components/gallery/InventoryList'
import { chipCounts, chipKey, filterInventory, rowPrice, rowStatus, type InventoryItem } from '@/components/gallery/inventory-core'
import { ArtworkPanel, type ArtworkPanelData } from '@/components/gallery/ArtworkPanel'
import { SelectableWorks, type SelectableCard } from '@/components/artworks/SelectableWorks'
import { flagOn } from '@/lib/flags'
import { holdsArtwork } from '@/lib/ownership/server'
import { listingOf } from '@/lib/gallery/listing-server'
import { rulesOf } from '@/lib/gallery/rules-server'
import { publicCertificate } from '@/lib/certificates/server'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'
import type { Scope } from '@/lib/scope/core'

export const metadata = { title: 'Obras — HouseArt' }

/** The work named by ?open= for the side panel (Acervo › obra): display fields only. */
async function panelOf(scope: Scope, id: number, userId: number) {
  const a = await getArtwork(scope, id)
  if (!a) return null
  const listing = a.status === 'LISTED' ? await listingOf(scope, a.id) : null
  const cert = a.publicId ? await publicCertificate(a.publicId) : null
  const slotName = new Map(MEDIA_SLOTS.map((s) => [s.kind, s.name]))
  const front = a.media.filter((m) => m.publicUrl).sort((x, y) => (x.kind === 'FRONT_COLOR_CARD' ? -1 : y.kind === 'FRONT_COLOR_CARD' ? 1 : 0))
  const st = rowStatus({ status: a.status as ArtworkStatus, listing: listing ? { views7d: 0, openOffers: 0, paused: listing.paused } : null })
  const data: ArtworkPanelData = {
    id: a.id, title: a.title, year: a.year, artist: a.artist.name, publicId: a.publicId, status: a.status, statusLabel: st.label, statusTone: st.tone,
    price: rowPrice({ saleMode: a.saleMode, listPriceCents: a.listPriceCents?.toString() ?? null }),
    images: front.map((m) => ({ url: m.publicUrl!, label: slotName.get(m.kind as never) ?? m.kind })),
    facts: [
      ['Técnica', [categoryLabel(a.category), a.technique, a.materials].filter(Boolean).join(' · ')], ['Dimensões', formatDimensions(a)],
      ['Edição', a.edition ?? ''], ['ID público', a.publicId ?? ''],
    ].filter(([, v]) => v && v !== '—').map(([k, v]) => ({ k: k!, v: v! })),
    certificate: cert ? { issuedAt: cert.issuedAt, status: cert.status } : null,
    provenance: (cert?.events ?? []).map((e) => ({ label: e.label, at: e.at })),
  }
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
        <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma obra aqui ainda.</p></div>
      ) : (
        // key={filter}: the selection starts over with each chip (the island would otherwise keep ids the new filter no longer shows)
        <SelectableWorks key={filter} items={items.map(cardOf)} markersOn={flagOn('FLAG_CERTIFICATES') && flagOn('FLAG_PHYSICAL_MARKERS') && scope.kind !== 'total'} canList={scope.kind !== 'total'} />
      )}
    </div>
  )
}
