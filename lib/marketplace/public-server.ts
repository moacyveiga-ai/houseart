// Public marketplace projection: only LISTED artworks with the GREEN seal,
// and only what the card shows (no owner, no documents, no floor).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ARTWORK_CATEGORIES, formatDimensions } from '@/lib/artworks/domain'

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
