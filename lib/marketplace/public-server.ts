// Public marketplace projection: only LISTED artworks with the GREEN seal,
// and only what the card shows (no owner, no documents, no floor).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ARTWORK_CATEGORIES, formatDimensions } from '@/lib/artworks/domain'
import { sizeKeyOf, type MarketItem } from './filter-core'
import { EVENT_LABELS, type EventKind } from '@/lib/certificates/core'

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

/** Statuses the public page shows (status badge by status; the price box only for LISTED). */
const PAGE_STATUSES = ['LISTED', 'IN_DEAL', 'SOLD', 'AUTHENTICATED', 'STOLEN', 'DISPUTED'] as const

export interface PublicArtworkSeller { name: string; kind: 'GALLERY' | 'PRIVATE'; slug: string | null; city: string | null; uf: string | null; representsArtist: boolean }
export interface PublicArtworkArtist { slug: string; name: string; birthYear: number | null; birthPlace: string | null; livesIn: string | null; bio: string | null; certifiedCount: number; forSaleCount: number; exhibitionsCount: number }
export interface PublicArtworkEvent { kind: string; label: string; at: string }

export interface PublicArtworkPage extends PublicArtworkCard {
  status: string; certificateStatus: 'PENDING' | 'ACTIVE' | 'CONTESTED' | 'REVOKED'
  artistSlug: string; technique: string | null; materials: string | null; dimensions: string; size: { heightMm: number | null; widthMm: number | null; depthMm: number | null }
  edition: string | null; signatureLocation: string | null; series: string | null; conditionGrade: string | null; conditionAt: string | null
  media: { kind: string; url: string }[]; fixedPrice: boolean; acceptsOffers: boolean
  history: { kind: string; description: string; occurredOn: string }[]
  events: PublicArtworkEvent[]
  seller: PublicArtworkSeller
  artistProfile: PublicArtworkArtist
}

export async function publicArtwork(publicId: string): Promise<PublicArtworkPage | null> {
  return totalScope('marketplace:artwork', async () => {
    const a = await prisma.artwork.findUnique({
      where: { publicId },
      include: {
        artist: { select: { id: true, name: true, slug: true, birthYear: true, tenantId: true, profile: { select: { birthPlace: true, livesIn: true, bio: true } } } },
        member: { select: { kind: true, displayName: true, city: true, uf: true, tenantId: true } },
        media: { where: { kind: { in: ['FRONT_COLOR_CARD', 'BACK', 'DETAIL'] } }, orderBy: { sortOrder: 'asc' } },
        historyItems: { orderBy: { sortOrder: 'asc' } },
        mandates: { where: { status: 'ACTIVE' }, select: { fixedPrice: true } },
        certificate: { select: { status: true, issuedAt: true, events: { orderBy: { seq: 'asc' }, select: { kind: true, occurredAt: true } } } },
      },
    })
    if (!a || !(PAGE_STATUSES as readonly string[]).includes(a.status)) return null
    // Stolen / disputed works keep a public page (the badge is the warning); the rest only with the green seal.
    if (a.status !== 'STOLEN' && a.status !== 'DISPUTED' && a.seal !== 'GREEN') return null
    const isGallery = a.member.kind === 'GALLERY_STAFF'
    const [gallery, certifiedCount, forSaleCount, exhibitionsCount] = await Promise.all([
      isGallery ? prisma.galleryPublicProfile.findUnique({ where: { tenantId: a.member.tenantId }, select: { slug: true } }) : null,
      prisma.artwork.count({ where: { artistId: a.artist.id, seal: 'GREEN', status: { in: ['AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD'] } } }),
      prisma.artwork.count({ where: { artistId: a.artist.id, status: 'LISTED', seal: 'GREEN' } }),
      prisma.artistEntry.count({ where: { artistId: a.artist.id, kind: { in: ['SOLO', 'GROUP'] } } }),
    ])
    const listed = a.status === 'LISTED'
    const fixedPrice = a.mandates[0]?.fixedPrice ?? false
    const c = a.certificate
    return {
      publicId, title: a.title, year: a.year, artist: a.artist.name, artistSlug: a.artist.slug, category: a.category,
      status: a.status, certificateStatus: !c || !c.issuedAt ? 'PENDING' : (c.status as 'ACTIVE' | 'CONTESTED' | 'REVOKED'),
      priceCents: listed && a.saleMode !== 'ON_REQUEST' ? a.listPriceCents : null, saleMode: a.saleMode,
      cover: a.media.find((m) => m.kind === 'FRONT_COLOR_CARD')?.publicUrl ?? null,
      technique: a.technique, materials: a.materials, dimensions: formatDimensions(a), size: { heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm },
      edition: a.edition, signatureLocation: a.signatureLocation, series: a.series, conditionGrade: a.conditionGrade, conditionAt: a.conditionAt?.toISOString() ?? null,
      media: a.media.filter((m) => m.publicUrl).map((m) => ({ kind: m.kind, url: m.publicUrl! })),
      fixedPrice, acceptsOffers: listed && a.saleMode !== 'ON_REQUEST',
      history: a.historyItems.map((h) => ({ kind: h.kind, description: h.description, occurredOn: h.occurredOn })),
      events: (c?.events ?? []).map((e) => ({ kind: e.kind, label: EVENT_LABELS[e.kind as EventKind] ?? e.kind, at: e.occurredAt.toISOString() })),
      seller: { name: isGallery ? a.member.displayName : 'Colecionador particular', kind: isGallery ? 'GALLERY' : 'PRIVATE', slug: gallery?.slug ?? null, city: a.member.city, uf: a.member.uf, representsArtist: isGallery && a.artist.tenantId !== null && a.artist.tenantId === a.member.tenantId },
      artistProfile: { slug: a.artist.slug, name: a.artist.name, birthYear: a.artist.birthYear, birthPlace: a.artist.profile?.birthPlace ?? null, livesIn: a.artist.profile?.livesIn ?? null, bio: a.artist.profile?.bio?.split(/\n\s*\n/)[0]?.trim() || null, certifiedCount, forSaleCount, exhibitionsCount },
    }
  })
}

/** "Mais desta artista e da galeria": other listed works of the same artist, then of the same seller. */
export async function relatedArtworks(publicId: string, take = 4): Promise<MarketItem[]> {
  return totalScope('marketplace:related', async () => {
    const a = await prisma.artwork.findUnique({ where: { publicId }, select: { id: true, artistId: true, memberId: true } })
    if (!a) return []
    const items = await marketItems(500)
    const byId = new Map(items.map((i) => [i.publicId, i]))
    const rows = await prisma.artwork.findMany({
      where: { status: 'LISTED', seal: 'GREEN', publicId: { not: null }, id: { not: a.id }, OR: [{ artistId: a.artistId }, { memberId: a.memberId }] },
      select: { publicId: true, artistId: true }, orderBy: { updatedAt: 'desc' }, take: 40,
    })
    const sorted = [...rows.filter((r) => r.artistId === a.artistId), ...rows.filter((r) => r.artistId !== a.artistId)]
    return sorted.map((r) => byId.get(r.publicId!)).filter((i): i is MarketItem => !!i).slice(0, take)
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
