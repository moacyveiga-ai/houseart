// Public content — I/O. Only what the public pages show; never documents,
// owners, floors or hashes. Everything runs in totalScope (public, no session).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { formatDimensions } from '@/lib/artworks/domain'
import { jsonList, lifeSpan, paragraphsOf, type ArtistEntryKind } from './domain'
import type { HeroPhoto } from './home-core'

// a seller suspended by the house is out of every public list
const LISTED = { status: 'LISTED', seal: 'GREEN', publicId: { not: null }, member: { tenant: { status: 'ACTIVE' } } } as const
const PUBLIC_STATUSES = ['LISTED', 'IN_DEAL', 'SOLD', 'AUTHENTICATED'] as const

export interface PublicWork { publicId: string; title: string; year: number | null; technique: string | null; dimensions: string; priceCents: bigint | null; saleMode: string | null; status: string; cover: string | null; seller: string | null; artist: string; artistSlug: string }

function workOf(a: { publicId: string | null; title: string; year: number | null; technique: string | null; heightMm: number | null; widthMm: number | null; depthMm: number | null; listPriceCents: bigint | null; saleMode: string | null; status: string; media: { publicUrl: string | null }[]; member: { displayName: string; kind: string }; artist: { name: string; slug: string } }): PublicWork {
  return { publicId: a.publicId!, title: a.title, year: a.year, technique: a.technique, dimensions: formatDimensions(a), priceCents: a.status === 'LISTED' && a.saleMode !== 'ON_REQUEST' ? a.listPriceCents : null, saleMode: a.saleMode, status: a.status, cover: a.media[0]?.publicUrl ?? null, seller: a.member.kind === 'GALLERY_STAFF' ? a.member.displayName : null, artist: a.artist.name, artistSlug: a.artist.slug }
}
const WORK_SELECT = { publicId: true, title: true, year: true, technique: true, heightMm: true, widthMm: true, depthMm: true, listPriceCents: true, saleMode: true, status: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 }, member: { select: { displayName: true, kind: true } }, artist: { select: { name: true, slug: true } } } as const

// ── artists ────────────────────────────────────────────────────────────────
export interface PublicArtistCard { slug: string; name: string; meta: string; count: number; photoUrl: string | null }

export async function listPublicArtists(q?: string | null, take = 60): Promise<PublicArtistCard[]> {
  return totalScope('public:artists', async () => {
    const rows = await prisma.artist.findMany({
      where: { artworks: { some: LISTED }, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      select: { slug: true, name: true, birthYear: true, deathYear: true, profile: { select: { livesIn: true, birthPlace: true, languagesJson: true, photoUrl: true } }, _count: { select: { artworks: { where: LISTED } } } },
      orderBy: { name: 'asc' }, take,
    })
    return rows.map((r) => {
      const lang = jsonList(r.profile?.languagesJson)[0]
      const place = r.profile?.livesIn ?? r.profile?.birthPlace ?? null
      const span = lifeSpan(r.birthYear, r.deathYear)
      return { slug: r.slug, name: r.name, meta: [span ?? lang, place].filter(Boolean).join(' · '), count: r._count.artworks, photoUrl: r.profile?.photoUrl ?? null }
    })
  })
}

export interface PublicArtistPage {
  /** the artist's account, target of "Seguir" (FOLLOW on MEMBER); null for a represented artist without account */
  followMemberId: number | null
  slug: string; name: string; fullName: string | null; alive: boolean; span: string | null; birthYear: number | null; deathYear: number | null
  facts: { k: string; v: string }[]; languages: string[]; quote: string | null; bio: string[]; photoUrl: string | null; photoCredit: string | null; royaltyBps: number | null
  entries: Record<ArtistEntryKind, { year: string; title: string; venue: string | null; city: string | null }[]>
  publications: { kind: string; title: string; meta: string | null; priceCents: bigint | null; action: string; url: string | null; coverUrl: string | null }[]
  works: PublicWork[]; representation: string | null; estateName: string | null
}

export async function publicArtist(slug: string): Promise<PublicArtistPage | null> {
  return totalScope('public:artist', async () => {
    const a = await prisma.artist.findUnique({
      where: { slug },
      include: { profile: true, entries: { orderBy: [{ sortOrder: 'asc' }, { year: 'desc' }] }, publications: { orderBy: { sortOrder: 'asc' } }, artworks: { where: { status: { in: [...PUBLIC_STATUSES] }, seal: 'GREEN', publicId: { not: null }, member: { tenant: { status: 'ACTIVE' } } }, select: WORK_SELECT, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] } },
    })
    if (!a) return null
    const p = a.profile
    const alive = !a.deathYear
    const facts: { k: string; v: string }[] = []
    if (a.birthYear) facts.push({ k: 'Nascimento', v: [String(a.birthYear), p?.birthPlace].filter(Boolean).join(' · ') })
    if (a.deathYear) facts.push({ k: 'Falecimento', v: [String(a.deathYear), p?.deathPlace].filter(Boolean).join(' · ') })
    if (alive && p?.livesIn) facts.push({ k: 'Vive e trabalha em', v: p.livesIn })
    if (p?.nationality) facts.push({ k: 'Nacionalidade', v: p.nationality })
    if (alive && p?.representation) facts.push({ k: 'Representação', v: p.representation })
    if (!alive && p?.estateName) facts.push({ k: 'Espólio', v: p.estateName })
    const entries = { TRAJECTORY: [], SOLO: [], GROUP: [], AWARD: [], EDUCATION: [], COLLECTION: [] } as PublicArtistPage['entries']
    for (const e of a.entries) (entries[e.kind as ArtistEntryKind] ?? (entries.TRAJECTORY)).push({ year: e.year, title: e.title, venue: e.venue, city: e.city })
    return {
      followMemberId: a.memberId ?? null,
      slug: a.slug, name: a.name, fullName: p?.fullName ?? null, alive, span: lifeSpan(a.birthYear, a.deathYear), birthYear: a.birthYear, deathYear: a.deathYear,
      facts, languages: jsonList(p?.languagesJson), quote: p?.quote ?? null, bio: paragraphsOf(p?.bio), photoUrl: p?.photoUrl ?? null, photoCredit: p?.photoCredit ?? null, royaltyBps: p?.royaltyBps ?? null,
      entries, publications: a.publications.map((b) => ({ kind: b.kind, title: b.title, meta: b.meta, priceCents: b.priceCents, action: b.action, url: b.url, coverUrl: b.coverUrl })),
      works: a.artworks.map(workOf), representation: p?.representation ?? null, estateName: p?.estateName ?? null,
    }
  })
}

// ── galleries ──────────────────────────────────────────────────────────────
export interface PublicGalleryCard { slug: string; name: string; city: string; uf: string | null; foundedYear: number | null; summary: string | null; tags: string[]; works: number; artists: number; covers: string[] }

export async function listPublicGalleries(f: { q?: string | null; uf?: string | null; tag?: string | null } = {}): Promise<PublicGalleryCard[]> {
  return totalScope('public:galleries', async () => {
    const rows = await prisma.galleryPublicProfile.findMany({
      where: { tenant: { status: 'ACTIVE' }, ...(f.uf ? { uf: f.uf.toUpperCase() } : {}), ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { city: { contains: f.q, mode: 'insensitive' } }] } : {}) },
      orderBy: { name: 'asc' },
    })
    const out: PublicGalleryCard[] = []
    for (const g of rows) {
      const tags = jsonList(g.tagsJson)
      if (f.tag && !tags.includes(f.tag)) continue
      const listed = await prisma.artwork.findMany({ where: { ...LISTED, tenantId: g.tenantId }, select: { artistId: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } }, orderBy: { updatedAt: 'desc' }, take: 60 })
      out.push({ slug: g.slug, name: g.name, city: [g.city, g.uf].filter(Boolean).join('/'), uf: g.uf, foundedYear: g.foundedYear, summary: g.summary, tags, works: listed.length, artists: new Set(listed.map((w) => w.artistId)).size, covers: listed.map((w) => w.media[0]?.publicUrl).filter((u): u is string => !!u).slice(0, 3) })
    }
    return out
  })
}

export interface PublicGalleryPage extends PublicGalleryCard {
  /** the gallery's first active team member, target of "Seguir galeria" (follows are per member) */
  followMemberId: number | null
  about: string[]; street: string | null; district: string | null; lat: number | null; lng: number | null; coverUrl: string | null; websiteUrl: string | null; instagram: string | null; email: string | null; phone: string | null; hours: string | null
  milestones: { year: string; title: string }[]; team: { name: string; role: string | null; photoUrl: string | null }[]; photos: { title: string; url: string | null }[]; videos: { title: string; url: string | null }[]; rooms: { title: string; url: string | null }[]
  publications: { kind: string; title: string; meta: string | null; priceCents: bigint | null; action: string; url: string | null; coverUrl: string | null }[]
  artworks: PublicWork[]; artistList: { slug: string; name: string; meta: string; photoUrl: string | null }[]
}

export async function publicGallery(slug: string): Promise<PublicGalleryPage | null> {
  return totalScope('public:gallery', async () => {
    const g = await prisma.galleryPublicProfile.findUnique({ where: { slug }, include: { tenant: { select: { status: true } } } })
    if (!g || g.tenant.status !== 'ACTIVE') return null
    const [items, pubs, works] = await Promise.all([
      prisma.galleryItem.findMany({ where: { tenantId: g.tenantId }, orderBy: { sortOrder: 'asc' } }),
      prisma.publication.findMany({ where: { tenantId: g.tenantId }, orderBy: { sortOrder: 'asc' } }),
      prisma.artwork.findMany({ where: { ...LISTED, tenantId: g.tenantId }, select: { ...WORK_SELECT, artistId: true }, orderBy: { updatedAt: 'desc' }, take: 120 }),
    ])
    const artistIds = [...new Set(works.map((w) => w.artistId))]
    const desk = await prisma.member.findFirst({ where: { tenantId: g.tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } })
    const artists = artistIds.length ? await prisma.artist.findMany({ where: { id: { in: artistIds } }, select: { slug: true, name: true, birthYear: true, deathYear: true, profile: { select: { livesIn: true, languagesJson: true, photoUrl: true } } }, orderBy: { name: 'asc' } }) : []
    const by = (kind: string) => items.filter((i) => i.kind === kind)
    const tags = jsonList(g.tagsJson)
    return {
      followMemberId: desk?.id ?? null,
      slug: g.slug, name: g.name, city: [g.city, g.uf].filter(Boolean).join('/'), uf: g.uf, foundedYear: g.foundedYear, summary: g.summary, tags, works: works.length, artists: artistIds.length, covers: works.map((w) => w.media[0]?.publicUrl).filter((u): u is string => !!u).slice(0, 3),
      about: paragraphsOf(g.about), street: g.street, district: g.district, lat: g.lat, lng: g.lng, coverUrl: g.coverUrl, websiteUrl: g.websiteUrl, instagram: g.instagram, email: g.email, phone: g.phone, hours: g.hours,
      milestones: by('MILESTONE').map((i) => ({ year: i.subtitle ?? '', title: i.title })), team: by('TEAM').map((i) => ({ name: i.title, role: i.subtitle, photoUrl: i.url })),
      photos: by('PHOTO').map((i) => ({ title: i.title, url: i.url })), videos: by('VIDEO').map((i) => ({ title: i.title, url: i.url })), rooms: by('ROOM').map((i) => ({ title: i.title, url: i.url })),
      publications: pubs.map((b) => ({ kind: b.kind, title: b.title, meta: b.meta, priceCents: b.priceCents, action: b.action, url: b.url, coverUrl: b.coverUrl })),
      artworks: works.map(workOf),
      artistList: artists.map((a) => ({ slug: a.slug, name: a.name, meta: [lifeSpan(a.birthYear, a.deathYear) ?? jsonList(a.profile?.languagesJson)[0], a.profile?.livesIn].filter(Boolean).join(' · '), photoUrl: a.profile?.photoUrl ?? null })),
    }
  })
}

/** The Home hero photo: the first exhibition room (lowest sortOrder) of the active gallery that saved
 *  its profile last (the editor rewrites the items, so ids follow the last save) — never a work
 *  (handoff §4.5): a "room" whose URL is the photo of an artwork is skipped, since the demo data and
 *  a careless editor can point a room at a work. Without rooms, the newest gallery cover under the
 *  same rule; without either, null (the Home shows the gradient alone). */
export async function homeHeroPhoto(): Promise<HeroPhoto | null> {
  return totalScope('public:hero', async () => {
    const rooms = await prisma.galleryItem.findMany({ where: { kind: 'ROOM', url: { not: null } }, orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }], take: 20, select: { title: true, url: true, tenantId: true } })
    const covers = await prisma.galleryPublicProfile.findMany({ where: { coverUrl: { not: null }, tenant: { status: 'ACTIVE' } }, orderBy: { id: 'desc' }, take: 5, select: { coverUrl: true, name: true } })
    const urls = [...rooms.map((r) => r.url!), ...covers.map((c) => c.coverUrl!)]
    if (urls.length === 0) return null
    const [galleries, artworkPhotos] = await Promise.all([
      prisma.galleryPublicProfile.findMany({ where: { tenantId: { in: [...new Set(rooms.map((r) => r.tenantId))] }, tenant: { status: 'ACTIVE' } }, select: { tenantId: true, name: true } }),
      prisma.artworkMedia.findMany({ where: { publicUrl: { in: urls } }, select: { publicUrl: true } }),
    ])
    const isWork = new Set(artworkPhotos.map((m) => m.publicUrl))
    const byTenant = new Map(galleries.map((g) => [g.tenantId, g.name]))
    const room = rooms.find((r) => byTenant.has(r.tenantId) && !isWork.has(r.url!))
    if (room) return { url: room.url!, gallery: byTenant.get(room.tenantId)!, room: room.title || null }
    const cover = covers.find((c) => !isWork.has(c.coverUrl!))
    return cover ? { url: cover.coverUrl!, gallery: cover.name, room: null } : null
  })
}

// ── news and agenda (Home) ─────────────────────────────────────────────────
export interface NewsCard { slug: string; category: string; title: string; summary: string | null; imageUrl: string | null; publishedAt: Date }

export async function listNews(take = 5): Promise<{ featured: NewsCard | null; others: NewsCard[] }> {
  return totalScope('public:news', async () => {
    const rows = await prisma.newsArticle.findMany({ where: { publishedAt: { not: null, lte: new Date() } }, orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }], take })
    const cards = rows.map((n) => ({ slug: n.slug, category: n.category, title: n.title, summary: n.summary, imageUrl: n.imageUrl, publishedAt: n.publishedAt! }))
    return { featured: cards[0] ?? null, others: cards.slice(1) }
  })
}

export interface NewsPage extends NewsCard { id: number; body: string[]; sourceName: string | null; sourceUrl: string | null; readMinutes: number; related: NewsCard[] }

/** One published article by slug, with the body in paragraphs and three related cards. */
export async function newsArticle(slug: string): Promise<NewsPage | null> {
  return totalScope('public:news-article', async () => {
    const n = await prisma.newsArticle.findFirst({ where: { slug, publishedAt: { not: null, lte: new Date() } } })
    if (!n) return null
    const others = await prisma.newsArticle.findMany({ where: { publishedAt: { not: null, lte: new Date() }, id: { not: n.id } }, orderBy: { publishedAt: 'desc' }, take: 3 })
    const body = paragraphsOf(n.body ?? n.summary ?? '')
    const words = body.join(' ').split(/\s+/).filter(Boolean).length
    return { id: n.id, slug: n.slug, category: n.category, title: n.title, summary: n.summary, imageUrl: n.imageUrl, publishedAt: n.publishedAt!, body, sourceName: n.sourceName, sourceUrl: n.sourceUrl, readMinutes: Math.max(1, Math.round(words / 200)), related: others.map((o) => ({ slug: o.slug, category: o.category, title: o.title, summary: o.summary, imageUrl: o.imageUrl, publishedAt: o.publishedAt! })) }
  })
}

export interface AgendaItem { id: number; kind: string; title: string; venue: string; city: string; startsOn: string; period: string | null; url: string | null }

/** Events from the first day of `fromMonth` (YYYY-MM) for `months` months, oldest first. */
export async function listAgenda(fromMonth: string, months = 4): Promise<AgendaItem[]> {
  return totalScope('public:agenda', async () => {
    const [y, m] = fromMonth.split('-').map(Number)
    const end = new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
    const rows = await prisma.agendaEvent.findMany({ where: { startsOn: { gte: `${fromMonth}-01`, lt: end } }, orderBy: { startsOn: 'asc' }, take: 200 })
    return rows.map((e) => ({ id: e.id, kind: e.kind, title: e.title, venue: e.venue, city: e.city, startsOn: e.startsOn, period: e.period, url: e.url }))
  })
}
