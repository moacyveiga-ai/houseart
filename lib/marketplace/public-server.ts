// Public marketplace projection: only LISTED artworks with the GREEN seal,
// and only what the card shows (no owner, no documents, no floor).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ARTWORK_CATEGORIES, formatDimensions } from '@/lib/artworks/domain'
import { sizeKeyOf, type MarketItem } from './filter-core'

export interface MarketplaceFilters { category?: string | null; maxPriceCents?: bigint | null; market?: string | null; uf?: string | null; q?: string | null }

export interface PublicArtworkCard { publicId: string; title: string; year: number | null; artist: string; priceCents: bigint | null; saleMode: string | null; cover: string | null; category: string }

export async function listPublicArtworks(f: MarketplaceFilters = {}, take = 60): Promise<PublicArtworkCard[]> {
  return totalScope('marketplace:list', async () => {
    const rows = await prisma.artwork.findMany({
      where: {
        status: 'LISTED', seal: 'GREEN', publicId: { not: null },
        ...(f.category && (ARTWORK_CATEGORIES as readonly string[]).includes(f.category) ? { category: f.category } : {}),
        ...(f.maxPriceCents ? { listPriceCents: { lte: f.maxPriceCents } } : {}),
        ...(f.market === 'PRIMARY' || f.market === 'SECONDARY' ? { market: f.market } : {}),
        ...(f.uf ? { member: { uf: f.uf.toUpperCase() } } : {}),
        ...(f.q ? { OR: [{ title: { contains: f.q, mode: 'insensitive' } }, { artist: { name: { contains: f.q, mode: 'insensitive' } } }] } : {}),
      },
      select: { publicId: true, title: true, year: true, listPriceCents: true, saleMode: true, category: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take,
    })
    return rows.map((r) => ({ publicId: r.publicId!, title: r.title, year: r.year, artist: r.artist.name, priceCents: r.saleMode === 'ON_REQUEST' ? null : r.listPriceCents, saleMode: r.saleMode, cover: r.media[0]?.publicUrl ?? null, category: r.category }))
  })
}

export interface PublicArtworkPage extends PublicArtworkCard { technique: string | null; materials: string | null; dimensions: string; edition: string | null; media: { kind: string; url: string }[]; fixedPrice: boolean; acceptsOffers: boolean; history: { kind: string; description: string; occurredOn: string }[] }

export async function publicArtwork(publicId: string): Promise<PublicArtworkPage | null> {
  return totalScope('marketplace:artwork', async () => {
    const a = await prisma.artwork.findUnique({ where: { publicId }, include: { artist: { select: { name: true } }, media: { where: { kind: { in: ['FRONT_COLOR_CARD', 'BACK', 'DETAIL'] } }, orderBy: { sortOrder: 'asc' } }, historyItems: { orderBy: { sortOrder: 'asc' } }, mandates: { where: { status: 'ACTIVE' }, select: { fixedPrice: true } } } })
    if (!a || a.status !== 'LISTED' || a.seal !== 'GREEN') return null
    const fixedPrice = a.mandates[0]?.fixedPrice ?? false
    return {
      publicId, title: a.title, year: a.year, artist: a.artist.name, priceCents: a.saleMode === 'ON_REQUEST' ? null : a.listPriceCents, saleMode: a.saleMode, cover: a.media.find((m) => m.kind === 'FRONT_COLOR_CARD')?.publicUrl ?? null, category: a.category,
      technique: a.technique, materials: a.materials, dimensions: formatDimensions(a), edition: a.edition,
      media: a.media.filter((m) => m.publicUrl).map((m) => ({ kind: m.kind, url: m.publicUrl! })), fixedPrice, acceptsOffers: a.saleMode !== 'ON_REQUEST',
      history: a.historyItems.map((h) => ({ kind: h.kind, description: h.description, occurredOn: h.occurredOn })),
    }
  })
}

// ── the public Marketplace of the handoff: the whole listed set, filtered by filter-core ──
export async function marketItems(take = 500): Promise<MarketItem[]> {
  return totalScope('marketplace:items', async () => {
    const rows = await prisma.artwork.findMany({
      where: { status: 'LISTED', seal: 'GREEN', publicId: { not: null } },
      select: { publicId: true, title: true, year: true, category: true, technique: true, heightMm: true, widthMm: true, depthMm: true, listPriceCents: true, saleMode: true, market: true, updatedAt: true, artist: { select: { name: true, slug: true } }, member: { select: { displayName: true, kind: true, uf: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take,
    })
    return rows.map((r) => ({
      publicId: r.publicId!, artist: r.artist.name, artistSlug: r.artist.slug, title: r.title, year: r.year, category: r.category, technique: r.technique, dimensions: formatDimensions(r), sizeKey: sizeKeyOf(r.heightMm, r.widthMm),
      priceCents: r.saleMode === 'ON_REQUEST' ? null : r.listPriceCents, saleMode: r.saleMode,
      seller: r.member.kind === 'GALLERY_STAFF' ? r.member.displayName : 'Colecionador particular', sellerKind: r.member.kind === 'GALLERY_STAFF' ? 'GALLERY' : 'PRIVATE',
      market: r.market === 'PRIMARY' || r.market === 'SECONDARY' ? r.market : null, uf: r.member.uf, cover: r.media[0]?.publicUrl ?? null, updatedAt: r.updatedAt.getTime(),
    }))
  })
}

/** Artists with listed works, for the Marketplace "Artistas" strip and the Home. */
export async function marketArtists(take = 6): Promise<{ slug: string; name: string; meta: string; count: number; photoUrl: string | null }[]> {
  return totalScope('marketplace:artists', async () => {
    const rows = await prisma.artist.findMany({
      where: { artworks: { some: { status: 'LISTED', seal: 'GREEN' } } },
      select: { slug: true, name: true, birthYear: true, deathYear: true, profile: { select: { livesIn: true, languagesJson: true, photoUrl: true } }, _count: { select: { artworks: { where: { status: 'LISTED', seal: 'GREEN' } } } } },
      orderBy: { artworks: { _count: 'desc' } }, take,
    })
    return rows.map((r) => {
      let lang: string | null = null
      try { lang = (JSON.parse(r.profile?.languagesJson || '[]') as string[])[0] ?? null } catch { lang = null }
      const span = r.deathYear ? `${r.birthYear ?? '?'}–${r.deathYear}` : null
      return { slug: r.slug, name: r.name, meta: [span ?? lang, r.profile?.livesIn].filter(Boolean).join(' · '), count: r._count.artworks, photoUrl: r.profile?.photoUrl ?? null }
    })
  })
}
