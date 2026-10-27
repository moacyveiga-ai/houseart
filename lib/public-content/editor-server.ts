// Editing of the public content — I/O. Three doors, each with its own owner:
//  · the house team (canEditPublicContent): news and agenda;
//  · the artist (the member of the Artist row): their own public profile;
//  · the gallery ADMIN (GALLERY_STAFF of a GALLERY tenant): the gallery's public
//    profile and the profiles of its represented artists WITHOUT an account.
// Lists (entries, publications, gallery items) are saved whole, inside one
// transaction. Images: the public derivative only (re-encoded JPEG, no EXIF).
import 'server-only'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { memberOfScope, type Scope } from '@/lib/scope/core'
import { savePublicFile } from '@/lib/storage/blob'
import { contentTypeOf } from '@/lib/storage/content-type'
import { audit, type AuditActor } from '@/lib/audit'
import { uniqueSlug } from '@/lib/tenant/slug'
import { jsonList } from './domain'
import {
  CONTENT_IMAGE_MAX_SIDE, ContentError, contentImageVerdict, newsState, nextPublishedAt, parseAgenda, parseArtistProfile, parseGalleryProfile, parseNews,
  type NewsState, type PublicationInput,
} from './editor-core'

type Actor = { userId: number; userName?: string } & Pick<AuditActor, 'ip' | 'userAgent'>
const NOT_FOUND = (what = 'Item') => new ContentError('NOT_FOUND', `${what} não encontrado.`, 404)
const thisYear = () => new Date().getUTCFullYear() + 1

// ── images ──────────────────────────────────────────────────────────────────
/** Validates by the bytes, re-encodes (≤ 2048 px JPEG, EXIF dropped) and stores the public derivative under `content/<folder>`. */
export async function uploadContentImage(folder: string, bytes: Buffer, actor: Actor): Promise<{ url: string; width: number; height: number }> {
  const type = contentTypeOf(bytes.subarray(0, 32), null)
  const v = contentImageVerdict(type, bytes.length)
  if (!v.ok) throw new ContentError('INVALID_FILE', v.error, v.status)
  let out: { data: Buffer; info: sharp.OutputInfo }
  try {
    out = await sharp(bytes, { failOn: 'error' }).rotate()
      .resize({ width: CONTENT_IMAGE_MAX_SIDE, height: CONTENT_IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true })
  } catch { throw new ContentError('INVALID_FILE', 'Imagem ilegível.', 415) }
  const url = await savePublicFile({ buffer: out.data, contentType: 'image/jpeg', prefix: `content/${folder}` })
  void audit.event({ entity: 'content_image', entityId: folder, action: 'upload', userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, after: { url } })
  return { url, width: out.info.width, height: out.info.height }
}

// ── news (house team) ───────────────────────────────────────────────────────
export interface NewsRow { id: number; slug: string; category: string; title: string; summary: string | null; body: string | null; imageUrl: string | null; sourceName: string | null; sourceUrl: string | null; featured: boolean; publishedAt: string | null; state: NewsState; createdAt: string }

function newsRow(n: { id: number; slug: string; category: string; title: string; summary: string | null; body: string | null; imageUrl: string | null; sourceName: string | null; sourceUrl: string | null; featured: boolean; publishedAt: Date | null; createdAt: Date }, now = new Date()): NewsRow {
  return { id: n.id, slug: n.slug, category: n.category, title: n.title, summary: n.summary, body: n.body, imageUrl: n.imageUrl, sourceName: n.sourceName, sourceUrl: n.sourceUrl, featured: n.featured, publishedAt: n.publishedAt?.toISOString() ?? null, state: newsState(n.publishedAt, now), createdAt: n.createdAt.toISOString() }
}

export async function listNewsForEditor(): Promise<NewsRow[]> {
  const rows = await prisma.newsArticle.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 300 })
  const now = new Date()
  return rows.map((n) => newsRow(n, now))
}

async function newsSlug(wanted: string | null, title: string, selfId: number | null): Promise<string> {
  const taken = async (s: string) => { const r = await prisma.newsArticle.findUnique({ where: { slug: s }, select: { id: true } }); return !!r && r.id !== selfId }
  if (wanted) {
    if (await taken(wanted)) throw new ContentError('SLUG_TAKEN', 'Já existe uma notícia com este endereço.', 409)
    return wanted
  }
  return uniqueSlug(title, taken)
}

export async function createNews(raw: unknown, actor: Actor): Promise<NewsRow> {
  const p = parseNews(raw)
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const { slug: wanted, featured, ...data } = p.value
  const slug = await newsSlug(wanted, data.title, null)
  const n = await prisma.$transaction(async (tx) => {
    if (featured) await tx.newsArticle.updateMany({ where: { featured: true }, data: { featured: false } })
    return tx.newsArticle.create({ data: { ...data, slug, featured } })
  })
  void audit.create({ entity: 'news_article', entityId: n.id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, after: { slug, title: n.title, category: n.category, featured } })
  return newsRow(n)
}

export async function updateNews(id: number, raw: unknown, actor: Actor): Promise<NewsRow> {
  const cur = await prisma.newsArticle.findUnique({ where: { id } })
  if (!cur) throw NOT_FOUND('Notícia')
  const p = parseNews(raw, new Set(cur.imageUrl ? [cur.imageUrl] : []))
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const { slug: wanted, featured, ...data } = p.value
  const slug = wanted && wanted !== cur.slug ? await newsSlug(wanted, data.title, id) : cur.slug
  const n = await prisma.$transaction(async (tx) => {
    if (featured && !cur.featured) await tx.newsArticle.updateMany({ where: { featured: true, id: { not: id } }, data: { featured: false } })
    return tx.newsArticle.update({ where: { id }, data: { ...data, slug, featured } })
  })
  void audit.update({ entity: 'news_article', entityId: id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: { slug: cur.slug, title: cur.title, category: cur.category, featured: cur.featured }, after: { slug, title: n.title, category: n.category, featured } })
  return newsRow(n)
}

export async function setNewsPublished(id: number, publish: boolean, actor: Actor): Promise<NewsRow> {
  const cur = await prisma.newsArticle.findUnique({ where: { id } })
  if (!cur) throw NOT_FOUND('Notícia')
  const publishedAt = nextPublishedAt(cur.publishedAt, publish, new Date())
  const n = await prisma.newsArticle.update({ where: { id }, data: { publishedAt } })
  void audit.event({ entity: 'news_article', entityId: id, action: publish ? 'publish' : 'unpublish', userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: { publishedAt: cur.publishedAt }, after: { publishedAt } })
  return newsRow(n)
}

/** Featured is exclusive: marking one unmarks the others (the Home shows one). */
export async function setNewsFeatured(id: number, featured: boolean, actor: Actor): Promise<NewsRow> {
  const cur = await prisma.newsArticle.findUnique({ where: { id }, select: { featured: true } })
  if (!cur) throw NOT_FOUND('Notícia')
  const n = await prisma.$transaction(async (tx) => {
    if (featured) await tx.newsArticle.updateMany({ where: { featured: true, id: { not: id } }, data: { featured: false } })
    return tx.newsArticle.update({ where: { id }, data: { featured } })
  })
  void audit.event({ entity: 'news_article', entityId: id, action: featured ? 'feature' : 'unfeature', userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: { featured: cur.featured }, after: { featured } })
  return newsRow(n)
}

export async function deleteNews(id: number, actor: Actor): Promise<void> {
  const cur = await prisma.newsArticle.findUnique({ where: { id }, select: { slug: true, title: true } })
  if (!cur) throw NOT_FOUND('Notícia')
  await prisma.newsArticle.delete({ where: { id } })
  void audit.remove({ entity: 'news_article', entityId: id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: cur })
}

// ── agenda (house team) ─────────────────────────────────────────────────────
export interface AgendaRow { id: number; kind: string; title: string; venue: string; city: string; startsOn: string; endsOn: string | null; period: string | null; url: string | null; byGallery: boolean }
const agendaRow = (e: { id: number; kind: string; title: string; venue: string; city: string; startsOn: string; endsOn: string | null; period: string | null; url: string | null; tenantId: number | null }): AgendaRow =>
  ({ id: e.id, kind: e.kind, title: e.title, venue: e.venue, city: e.city, startsOn: e.startsOn, endsOn: e.endsOn, period: e.period, url: e.url, byGallery: e.tenantId !== null })

export async function listAgendaForEditor(): Promise<AgendaRow[]> {
  const rows = await prisma.agendaEvent.findMany({ orderBy: [{ startsOn: 'desc' }, { id: 'desc' }], take: 400 })
  return rows.map(agendaRow)
}

export async function createAgendaEvent(raw: unknown, actor: Actor): Promise<AgendaRow> {
  const p = parseAgenda(raw)
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const e = await prisma.agendaEvent.create({ data: p.value })
  void audit.create({ entity: 'agenda_event', entityId: e.id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, after: { title: e.title, kind: e.kind, startsOn: e.startsOn } })
  return agendaRow(e)
}

export async function updateAgendaEvent(id: number, raw: unknown, actor: Actor): Promise<AgendaRow> {
  const cur = await prisma.agendaEvent.findUnique({ where: { id } })
  if (!cur) throw NOT_FOUND('Evento')
  const p = parseAgenda(raw)
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const e = await prisma.agendaEvent.update({ where: { id }, data: p.value })
  void audit.update({ entity: 'agenda_event', entityId: id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: { title: cur.title, kind: cur.kind, startsOn: cur.startsOn }, after: { title: e.title, kind: e.kind, startsOn: e.startsOn } })
  return agendaRow(e)
}

export async function deleteAgendaEvent(id: number, actor: Actor): Promise<void> {
  const cur = await prisma.agendaEvent.findUnique({ where: { id }, select: { title: true, startsOn: true } })
  if (!cur) throw NOT_FOUND('Evento')
  await prisma.agendaEvent.delete({ where: { id } })
  void audit.remove({ entity: 'agenda_event', entityId: id, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: cur })
}

// ── publications (shared) ───────────────────────────────────────────────────
export interface PublicationRow { kind: string; title: string; meta: string | null; priceCents: string | null; action: string; url: string | null; coverUrl: string | null }
const publicationRow = (b: { kind: string; title: string; meta: string | null; priceCents: bigint | null; action: string; url: string | null; coverUrl: string | null }): PublicationRow =>
  ({ kind: b.kind, title: b.title, meta: b.meta, priceCents: b.priceCents === null ? null : b.priceCents.toString(), action: b.action, url: b.url, coverUrl: b.coverUrl })
const pubData = (p: PublicationInput) => ({ kind: p.kind, title: p.title, meta: p.meta, priceCents: p.priceCents, action: p.action, url: p.url, coverUrl: p.coverUrl, sortOrder: p.sortOrder })

// ── artist ──────────────────────────────────────────────────────────────────
export interface ArtistProfileView {
  artist: { id: number; name: string; slug: string }
  fullName: string | null; birthPlace: string | null; livesIn: string | null; nationality: string | null; quote: string | null; bio: string | null
  languages: string[]; photoUrl: string | null; photoCredit: string | null
  entries: { kind: string; year: string; title: string; venue: string | null; city: string | null }[]
  publications: PublicationRow[]
}

/** The Artist of the session's member (the artist's own door). 404 when the member is not an artist. */
export async function ownArtistId(scope: Scope): Promise<number> {
  const memberId = memberOfScope(scope)
  if (!memberId) throw NOT_FOUND('Perfil de artista')
  const a = await prisma.artist.findUnique({ where: { memberId }, select: { id: true } })
  if (!a) throw NOT_FOUND('Perfil de artista')
  return a.id
}

export async function artistProfileView(artistId: number): Promise<ArtistProfileView> {
  const a = await prisma.artist.findUnique({
    where: { id: artistId },
    include: { profile: true, entries: { orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }, publications: { where: { tenantId: null }, orderBy: { sortOrder: 'asc' } } },
  })
  if (!a) throw NOT_FOUND('Perfil de artista')
  const p = a.profile
  return {
    artist: { id: a.id, name: a.name, slug: a.slug },
    fullName: p?.fullName ?? null, birthPlace: p?.birthPlace ?? null, livesIn: p?.livesIn ?? null, nationality: p?.nationality ?? null, quote: p?.quote ?? null, bio: p?.bio ?? null,
    languages: jsonList(p?.languagesJson), photoUrl: p?.photoUrl ?? null, photoCredit: p?.photoCredit ?? null,
    entries: a.entries.map((e) => ({ kind: e.kind, year: e.year, title: e.title, venue: e.venue, city: e.city })),
    publications: a.publications.map(publicationRow),
  }
}

export async function saveArtistProfile(artistId: number, raw: unknown, actor: Actor & { via: 'artist' | 'gallery' }): Promise<ArtistProfileView> {
  const cur = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, profile: { select: { photoUrl: true } }, publications: { where: { tenantId: null }, select: { coverUrl: true } }, _count: { select: { entries: true } } } })
  if (!cur) throw NOT_FOUND('Perfil de artista')
  const keep = new Set([cur.profile?.photoUrl, ...cur.publications.map((b) => b.coverUrl)].filter((u): u is string => !!u))
  const p = parseArtistProfile(raw, keep)
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const { profile, entries, publications } = p.value
  await prisma.$transaction(async (tx) => {
    await tx.artistProfile.upsert({ where: { artistId }, create: { artistId, ...profile }, update: profile })
    await tx.artistEntry.deleteMany({ where: { artistId } })
    if (entries.length) await tx.artistEntry.createMany({ data: entries.map((e) => ({ artistId, ...e })) })
    await tx.publication.deleteMany({ where: { artistId, tenantId: null } })
    if (publications.length) await tx.publication.createMany({ data: publications.map((b) => ({ artistId, tenantId: null, ...pubData(b) })) })
  })
  void audit.update({ entity: 'artist_profile', entityId: artistId, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent, before: { entries: cur._count.entries, publications: cur.publications.length }, after: { via: actor.via, entries: entries.length, publications: publications.length, photo: !!profile.photoUrl } })
  return artistProfileView(artistId)
}

// ── gallery ─────────────────────────────────────────────────────────────────
/** The gallery ADMIN's tenant: GALLERY_STAFF of a GALLERY tenant with the ADMIN role. Anything else is 403. */
export async function galleryAdminTenant(scope: Scope): Promise<number> {
  const forbidden = new ContentError('FORBIDDEN', 'Só o administrador da galeria edita o perfil público.', 403)
  if (scope.kind !== 'tenant' || !scope.memberId) throw forbidden
  const m = await prisma.member.findUnique({ where: { id: scope.memberId }, select: { kind: true, role: true, tenantId: true, status: true, user: { select: { tenantRole: true } }, tenant: { select: { kind: true } } } })
  if (!m || m.tenantId !== scope.tenantId || m.kind !== 'GALLERY_STAFF' || m.tenant.kind !== 'GALLERY' || m.status !== 'ACTIVE') throw forbidden
  if (m.role !== 'ADMIN' && !(m.role === null && m.user?.tenantRole === 'ADMIN')) throw forbidden
  return scope.tenantId
}

/** A represented artist WITHOUT an account (the gallery speaks for them). 404 otherwise. */
export async function representedArtistId(tenantId: number, artistId: number): Promise<number> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, tenantId: true, memberId: true } })
  if (!a || a.tenantId !== tenantId || a.memberId !== null) throw NOT_FOUND('Artista')
  return a.id
}

export interface GalleryProfileView {
  slug: string | null; name: string; city: string | null; uf: string | null; foundedYear: number | null; summary: string | null; about: string | null; tags: string[]
  street: string | null; district: string | null; lat: number | null; lng: number | null; coverUrl: string | null; websiteUrl: string | null; instagram: string | null; email: string | null; phone: string | null; hours: string | null
  items: { kind: string; title: string; subtitle: string | null; url: string | null; body: string | null; email: string | null; phone: string | null }[]
  publications: PublicationRow[]
  artists: { id: number; name: string; slug: string }[]
}

export async function galleryProfileView(tenantId: number): Promise<GalleryProfileView> {
  const [tenant, g, items, pubs, artists] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.galleryPublicProfile.findUnique({ where: { tenantId } }),
    prisma.galleryItem.findMany({ where: { tenantId }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.publication.findMany({ where: { tenantId, artistId: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.artist.findMany({ where: { tenantId, memberId: null }, select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
  ])
  if (!tenant) throw NOT_FOUND('Galeria')
  return {
    slug: g?.slug ?? null, name: g?.name ?? tenant.name, city: g?.city ?? null, uf: g?.uf ?? null, foundedYear: g?.foundedYear ?? null, summary: g?.summary ?? null, about: g?.about ?? null, tags: jsonList(g?.tagsJson),
    street: g?.street ?? null, district: g?.district ?? null, lat: g?.lat ?? null, lng: g?.lng ?? null, coverUrl: g?.coverUrl ?? null, websiteUrl: g?.websiteUrl ?? null, instagram: g?.instagram ?? null, email: g?.email ?? null, phone: g?.phone ?? null, hours: g?.hours ?? null,
    items: items.map((i) => ({ kind: i.kind, title: i.title, subtitle: i.subtitle, url: i.url, body: i.body, email: i.email, phone: i.phone })),
    publications: pubs.map(publicationRow),
    artists,
  }
}

export async function saveGalleryProfile(tenantId: number, raw: unknown, actor: Actor): Promise<GalleryProfileView> {
  const [g, items, pubs] = await Promise.all([
    prisma.galleryPublicProfile.findUnique({ where: { tenantId }, select: { id: true, coverUrl: true } }),
    prisma.galleryItem.findMany({ where: { tenantId }, select: { url: true } }),
    prisma.publication.findMany({ where: { tenantId, artistId: null }, select: { coverUrl: true } }),
  ])
  const keep = new Set([g?.coverUrl, ...items.map((i) => i.url), ...pubs.map((b) => b.coverUrl)].filter((u): u is string => !!u))
  const p = parseGalleryProfile(raw, keep, thisYear())
  if (!p.ok) throw new ContentError('INVALID', p.error)
  const v = p.value
  const slug = g ? null : await uniqueSlug(v.profile.name, async (s) => !!(await prisma.galleryPublicProfile.findUnique({ where: { slug: s }, select: { id: true } })))
  await prisma.$transaction(async (tx) => {
    if (g) await tx.galleryPublicProfile.update({ where: { tenantId }, data: v.profile })
    else await tx.galleryPublicProfile.create({ data: { tenantId, slug: slug!, ...v.profile } })
    await tx.galleryItem.deleteMany({ where: { tenantId } })
    if (v.items.length) await tx.galleryItem.createMany({ data: v.items.map((i) => ({ tenantId, ...i })) })
    await tx.publication.deleteMany({ where: { tenantId, artistId: null } })
    if (v.publications.length) await tx.publication.createMany({ data: v.publications.map((b) => ({ tenantId, artistId: null, ...pubData(b) })) })
  })
  const entry = { entity: 'gallery_public_profile', entityId: tenantId, userId: actor.userId, userName: actor.userName, ip: actor.ip, userAgent: actor.userAgent }
  if (g) void audit.update({ ...entry, before: { items: items.length, publications: pubs.length }, after: { name: v.profile.name, items: v.items.length, publications: v.publications.length } })
  else void audit.create({ ...entry, after: { slug, name: v.profile.name, items: v.items.length, publications: v.publications.length } })
  return galleryProfileView(tenantId)
}
