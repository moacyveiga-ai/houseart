// The editors of the public content: news and agenda (house team), the artist's
// own public profile and the gallery's (ADMIN only, plus its represented artists
// without an account). Every door stays with its owner: another artist, another
// gallery, a non-admin of the gallery and anyone outside the team get 403/404.
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listNews, publicArtist, publicGallery } from '@/lib/public-content/server'
import { GET as newsGet, POST as newsPost } from '@/app/api/admin/content/news/route'
import { PATCH as newsPatch, DELETE as newsDelete } from '@/app/api/admin/content/news/[id]/route'
import { POST as newsPublish } from '@/app/api/admin/content/news/[id]/publish/route'
import { POST as newsFeature } from '@/app/api/admin/content/news/[id]/feature/route'
import { GET as agendaGet, POST as agendaPost } from '@/app/api/admin/content/agenda/route'
import { PATCH as agendaPatch, DELETE as agendaDelete } from '@/app/api/admin/content/agenda/[id]/route'
import { POST as adminImage } from '@/app/api/admin/content/images/route'
import { GET as artistGet, PUT as artistPut } from '@/app/api/artist/profile/route'
import { POST as artistImage } from '@/app/api/artist/profile/images/route'
import { GET as galleryGet, PUT as galleryPut } from '@/app/api/gallery/public-profile/route'
import { POST as galleryImage } from '@/app/api/gallery/public-profile/images/route'
import { GET as repGet, PUT as repPut } from '@/app/api/gallery/public-profile/artists/[id]/route'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'
import { hashPassword } from '@/lib/auth'

const json = (url: string, method: string, body?: unknown) => new Request(`http://test${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })
const upload = (url: string, bytes: Buffer, type = 'image/png') => { const f = new FormData(); f.set('file', new Blob([new Uint8Array(bytes)], { type }), 'x.png'); return new Request(`http://test${url}`, { method: 'POST', body: f }) }
const written: string[] = []
const keep = (url: string) => { if (url.startsWith('/uploads/')) written.push(path.join(process.cwd(), 'public', url)); return url }

let s: Scenario
let tomasId: number
let otherGallery: { userId: number; tenantId: number }
let salesUserId: number

beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['NewsArticle', 'AgendaEvent', 'GalleryPublicProfile', 'GalleryItem', 'Publication', 'ArtistProfile', 'ArtistEntry'])
  tomasId = (await prisma.artist.findUniqueOrThrow({ where: { slug: 'tomas-rezende' } })).id
  const pw = await hashPassword('senha-forte-1')
  // a second gallery with its own ADMIN
  const g2 = await prisma.tenant.create({ data: { kind: 'GALLERY', name: 'Casa Tamarindo', slug: 'casa-tamarindo' } })
  const u2 = await prisma.user.create({ data: { email: 'c1@tamarindo.test', name: 'Carla Tamarindo', passwordHash: pw, profile: 'member', active: true, profiles: { create: { kind: 'GALLERY', isDefault: true } } } })
  const m2 = await prisma.member.create({ data: { userId: u2.id, tenantId: g2.id, kind: 'GALLERY_STAFF', role: 'ADMIN', displayName: 'Carla Tamarindo', slug: 'carla' } })
  await prisma.user.update({ where: { id: u2.id }, data: { memberId: m2.id, tenantId: g2.id, tenantRole: 'ADMIN' } })
  otherGallery = { userId: u2.id, tenantId: g2.id }
  // a SALES staff of gallery A (not admin)
  const u3 = await prisma.user.create({ data: { email: 'v@galeria.test', name: 'Vera Vendas', passwordHash: pw, profile: 'member', active: true, profiles: { create: { kind: 'GALLERY', isDefault: true } } } })
  const m3 = await prisma.member.create({ data: { userId: u3.id, tenantId: s.galleryTenantId, kind: 'GALLERY_STAFF', role: 'SALES', displayName: 'Vera Vendas', slug: 'vera' } })
  await prisma.user.update({ where: { id: u3.id }, data: { memberId: m3.id, tenantId: s.galleryTenantId, tenantRole: 'MEMBER' } })
  salesUserId = u3.id
  signOut()
})

describe('news and agenda (house team)', () => {
  it('refuse without a session and outside the content team', async () => {
    expect((await newsGet()).status).toBe(401)
    await signIn(s.b.userId, 'ARTIST')
    expect((await newsGet()).status).toBe(403)
    expect((await newsPost(json('/api/admin/content/news', 'POST', { title: 'Invasão', category: 'Mercado' }))).status).toBe(403)
    expect((await agendaPost(json('/api/admin/content/agenda', 'POST', {}))).status).toBe(403)
    await signIn(s.a1.userId, 'GALLERY')
    expect((await agendaGet()).status).toBe(403)
    expect(await prisma.newsArticle.count()).toBe(0)
    // finance is staff but does not edit the site
    const fin = await prisma.user.create({ data: { email: 'fin@houseart.test', name: 'Fin', passwordHash: 'x', profile: 'finance', active: true } })
    await signIn(fin.id)
    expect((await newsGet()).status).toBe(403)
  }, 60_000)

  it('create as draft, publish, feature (exclusive), edit, delete', async () => {
    await signIn(s.staff.userId)
    const a = await newsPost(json('/api/admin/content/news', 'POST', { title: 'Feira de Salvador abre em novembro', category: 'Feiras', summary: 'Resumo', body: 'Um.\n\nDois.' }))
    expect(a.status).toBe(201)
    const na = (await a.json() as { news: { id: number; slug: string; state: string } }).news
    expect(na).toMatchObject({ slug: 'feira-de-salvador-abre-em-novembro', state: 'DRAFT' })
    expect((await listNews()).featured).toBeNull()

    // same title → next slug; an explicit slug already taken → 409
    const b = (await (await newsPost(json('/api/admin/content/news', 'POST', { title: 'Feira de Salvador abre em novembro', category: 'Mercado', featured: true }))).json() as { news: { id: number; slug: string; featured: boolean } }).news
    expect(b.slug).toBe('feira-de-salvador-abre-em-novembro-2')
    expect((await newsPost(json('/api/admin/content/news', 'POST', { title: 'Outra', category: 'Mercado', slug: na.slug }))).status).toBe(409)
    expect((await newsPost(json('/api/admin/content/news', 'POST', { title: 'Outra', category: 'Leilões' }))).status).toBe(400)

    expect((await newsPublish(json('/x', 'POST', { published: true }), ctx(na.id))).status).toBe(200)
    expect((await listNews()).featured?.slug).toBe(na.slug)
    expect((await newsFeature(json('/x', 'POST', { featured: true }), ctx(na.id))).status).toBe(200)
    expect((await prisma.newsArticle.findUniqueOrThrow({ where: { id: b.id } })).featured).toBe(false)
    expect((await newsPublish(json('/x', 'POST', {}), ctx(na.id))).status).toBe(400)

    // an image that was not uploaded here is refused; an uploaded one is kept
    expect((await newsPatch(json('/x', 'PATCH', { title: 'Feira de Salvador', category: 'Feiras', imageUrl: 'https://tracker.example/p.gif' }), ctx(na.id))).status).toBe(400)
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c0a080' } }).png().toBuffer()
    const up = await adminImage(upload('/api/admin/content/images', png))
    expect(up.status).toBe(201)
    const img = keep((await up.json() as { url: string }).url)
    expect(img).toMatch(/^\/uploads\/content\/news\/.+\.jpg$/)
    expect((await adminImage(upload('/api/admin/content/images', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'))).status).toBe(415)
    const edited = await newsPatch(json('/x', 'PATCH', { title: 'Feira de Salvador', category: 'Feiras', imageUrl: img, featured: true }), ctx(na.id))
    expect(edited.status).toBe(200)
    expect((await listNews()).featured).toMatchObject({ title: 'Feira de Salvador', imageUrl: img })

    // unpublish → off the site; delete; unknown id → 404
    await newsPublish(json('/x', 'POST', { published: false }), ctx(na.id))
    expect((await listNews()).featured).toBeNull()
    expect((await newsDelete(json('/x', 'DELETE'), ctx(na.id))).status).toBe(200)
    expect((await newsDelete(json('/x', 'DELETE'), ctx(na.id))).status).toBe(404)
    expect((await newsPatch(json('/x', 'PATCH', { title: 'Abc', category: 'Feiras' }), ctx('abc'))).status).toBe(404)
    expect(await prisma.newsArticle.count()).toBe(1)
    await expect.poll(() => prisma.auditLog.count({ where: { entity: 'news_article' } })).toBeGreaterThanOrEqual(5)
  }, 60_000)

  it('agenda CRUD with date checks', async () => {
    await signIn(s.staff.userId)
    const r = await agendaPost(json('/api/admin/content/agenda', 'POST', { kind: 'FAIR', title: 'SP-Arte', venue: 'Bienal', city: 'São Paulo/SP', startsOn: '2026-11-05', endsOn: '2026-11-09' }))
    expect(r.status).toBe(201)
    const ev = (await r.json() as { event: { id: number } }).event
    expect((await agendaPatch(json('/x', 'PATCH', { kind: 'FAIR', title: 'SP-Arte', venue: 'Bienal', city: 'São Paulo/SP', startsOn: '2026-11-05', endsOn: '2026-11-01' }), ctx(ev.id))).status).toBe(400)
    expect((await agendaPatch(json('/x', 'PATCH', { kind: 'OPENING', title: 'SP-Arte 2026', venue: 'Bienal', city: 'São Paulo/SP', startsOn: '2026-11-06' }), ctx(ev.id))).status).toBe(200)
    expect(await prisma.agendaEvent.findUniqueOrThrow({ where: { id: ev.id } })).toMatchObject({ kind: 'OPENING', startsOn: '2026-11-06', endsOn: null })
    const list = await (await agendaGet()).json() as { events: unknown[] }
    expect(list.events).toHaveLength(1)
    expect((await agendaDelete(json('/x', 'DELETE'), ctx(ev.id))).status).toBe(200)
    expect(await prisma.agendaEvent.count()).toBe(0)
  }, 60_000)
})

describe('artist profile (own)', () => {
  it('the artist edits only their own profile', async () => {
    expect((await artistGet()).status).toBe(401)
    await signIn(s.b.userId, 'ARTIST')
    const g = await artistGet()
    expect(g.status).toBe(200)
    const body = await g.json() as { profile: { artist: { slug: string } } }
    expect(body.profile.artist.slug).toBe('joana-artist')

    const put = await artistPut(json('/api/artist/profile', 'PUT', {
      bio: 'Pinta a luz da Baía.\n\nVive em Salvador.', quote: 'A cor é o lugar.', livesIn: 'Salvador/BA', birthPlace: 'Ilhéus/BA', languages: ['Pintura', 'Óleo sobre linho'],
      entries: [{ kind: 'SOLO', year: '2026', title: 'Maré', venue: 'MAM-BA', city: 'Salvador' }, { kind: 'AWARD', year: '2024', title: 'Prêmio Bahia' }],
      publications: [{ kind: 'CATALOGUE', title: 'Maré — catálogo', priceCents: '4990', action: 'BUY', url: 'https://loja.example/mare' }],
    }))
    expect(put.status).toBe(200)
    const page = await publicArtist('joana-artist')
    expect(page).toMatchObject({ quote: 'A cor é o lugar.', languages: ['Pintura', 'Óleo sobre linho'], bio: ['Pinta a luz da Baía.', 'Vive em Salvador.'] })
    expect(page!.entries.SOLO).toEqual([{ year: '2026', title: 'Maré', venue: 'MAM-BA', city: 'Salvador' }])
    expect(page!.publications).toEqual([expect.objectContaining({ title: 'Maré — catálogo', priceCents: 4990n, action: 'BUY' })])

    // invalid list → 400 and nothing written
    expect((await artistPut(json('/x', 'PUT', { entries: [{ kind: 'SOLO', year: '', title: 'x' }] }))).status).toBe(400)
    expect(await prisma.artistEntry.count()).toBe(2)

    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#203040' } }).jpeg().toBuffer()
    const up = await artistImage(upload('/api/artist/profile/images', png, 'image/jpeg'))
    expect(up.status).toBe(201)
    const url = keep((await up.json() as { url: string }).url)
    expect(url).toMatch(/^\/uploads\/content\/artists\/\d+\//)
    expect((await artistPut(json('/x', 'PUT', { photoUrl: url, photoCredit: 'Foto: Ana' }))).status).toBe(200)
    expect((await publicArtist('joana-artist'))!.photoUrl).toBe(url)
    await expect.poll(() => prisma.auditLog.count({ where: { entity: 'artist_profile' } })).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it('gallery staff, advisor and staff have no artist profile here (404)', async () => {
    for (const [u, kind] of [[s.a1.userId, 'GALLERY'], [s.a2.userId, 'ADVISOR'], [s.staff.userId, null]] as const) {
      await signIn(u, kind)
      expect((await artistGet()).status).toBe(404)
      expect((await artistPut(json('/x', 'PUT', { bio: 'x' }))).status).toBe(404)
    }
    expect(await prisma.artistProfile.count()).toBe(0)
  }, 60_000)
})

describe('gallery public profile (ADMIN)', () => {
  it('the admin creates and edits the gallery page; the items and publications go public', async () => {
    expect((await galleryGet()).status).toBe(401)
    await signIn(s.a1.userId, 'GALLERY')
    const g = await (await galleryGet()).json() as { profile: { slug: string | null; name: string; artists: { id: number }[] } }
    expect(g.profile).toMatchObject({ slug: null, name: 'Galeria Ladeira', artists: [{ id: tomasId, name: 'Tomás Rezende', slug: 'tomas-rezende' }] })

    const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#ffffff' } }).webp().toBuffer()
    const up = await galleryImage(upload('/api/gallery/public-profile/images', png, 'image/webp'))
    expect(up.status).toBe(201)
    const cover = keep((await up.json() as { url: string }).url)
    const put = await galleryPut(json('/api/gallery/public-profile', 'PUT', {
      name: 'Galeria Ladeira', city: 'Salvador', uf: 'ba', foundedYear: 2009, summary: 'Contemporânea no Santo Antônio.', about: 'Sobre.\n\nMais.', tags: ['Contemporânea', 'Pintura'],
      street: 'Ladeira do Carmo, 10', district: 'Santo Antônio', lat: -12.97, lng: -38.51, coverUrl: cover, instagram: '@ladeira', email: 'oi@ladeira.test', hours: 'Ter a sáb',
      items: [{ kind: 'MILESTONE', title: 'Fundação', subtitle: '2009' }, { kind: 'TEAM', title: 'Ana Ladeira', subtitle: 'Diretora', url: cover }],
      publications: [{ kind: 'ESSAY', title: 'Ensaio da casa' }],
    }))
    expect(put.status).toBe(200)
    const out = await put.json() as { profile: { slug: string } }
    expect(out.profile.slug).toBe('galeria-ladeira')
    const page = await publicGallery('galeria-ladeira')
    expect(page).toMatchObject({ city: 'Salvador/BA', tags: ['Contemporânea', 'Pintura'], coverUrl: cover, instagram: 'ladeira', milestones: [{ year: '2009', title: 'Fundação' }], team: [{ name: 'Ana Ladeira', role: 'Diretora', photoUrl: cover }] })
    expect(page!.publications.map((p) => p.title)).toEqual(['Ensaio da casa'])

    // a second save keeps the slug; a foreign image is refused
    expect((await galleryPut(json('/x', 'PUT', { name: 'Ladeira', coverUrl: 'https://outra.example/c.jpg' }))).status).toBe(400)
    expect((await galleryPut(json('/x', 'PUT', { name: 'Ladeira Arte', coverUrl: cover }))).status).toBe(200)
    expect(await prisma.galleryPublicProfile.findUniqueOrThrow({ where: { tenantId: s.galleryTenantId } })).toMatchObject({ slug: 'galeria-ladeira', name: 'Ladeira Arte' })
    expect(await prisma.galleryItem.count()).toBe(0)
    await expect.poll(() => prisma.auditLog.count({ where: { entity: 'gallery_public_profile' } })).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it('sales staff, the advisor, an artist and the house staff cannot edit a gallery page (403)', async () => {
    for (const [u, kind] of [[salesUserId, 'GALLERY'], [s.a2.userId, 'ADVISOR'], [s.b.userId, 'ARTIST'], [s.staff.userId, null]] as const) {
      await signIn(u, kind)
      expect((await galleryGet()).status, `user ${u}`).toBe(403)
      expect((await galleryPut(json('/x', 'PUT', { name: 'Invasão' }))).status).toBe(403)
      expect((await galleryImage(upload('/x', Buffer.from('x')))).status).toBe(403)
      expect((await repPut(json('/x', 'PUT', { bio: 'x' }), ctx(tomasId))).status).toBe(403)
    }
    expect(await prisma.galleryPublicProfile.count()).toBe(0)
  }, 60_000)

  it('the gallery edits its represented artists without an account — never another gallery’s, never one with an account', async () => {
    await signIn(s.a1.userId, 'GALLERY')
    expect((await repGet(json('/x', 'GET'), ctx(tomasId))).status).toBe(200)
    expect((await repPut(json('/x', 'PUT', { bio: 'Escultor.', entries: [{ kind: 'GROUP', year: '2025', title: 'Coletiva' }] }), ctx(tomasId))).status).toBe(200)
    expect((await publicArtist('tomas-rezende'))!.bio).toEqual(['Escultor.'])
    // the artist WITH an account (Joana, other tenant) and an unknown id
    const joana = await prisma.artist.findUniqueOrThrow({ where: { slug: 'joana-artist' } })
    expect((await repPut(json('/x', 'PUT', { bio: 'x' }), ctx(joana.id))).status).toBe(404)
    expect((await repGet(json('/x', 'GET'), ctx(999999))).status).toBe(404)
    // an artist of the gallery who has an account edits their own profile, not the gallery
    const withAccount = await prisma.artist.create({ data: { tenantId: s.galleryTenantId, memberId: s.a2.memberId, name: 'Caio Artista', slug: 'caio-artista' } })
    expect((await repPut(json('/x', 'PUT', { bio: 'x' }), ctx(withAccount.id))).status).toBe(404)

    await signIn(otherGallery.userId, 'GALLERY')
    expect((await repGet(json('/x', 'GET'), ctx(tomasId))).status).toBe(404)
    expect((await repPut(json('/x', 'PUT', { bio: 'Tomado.' }), ctx(tomasId))).status).toBe(404)
    expect((await publicArtist('tomas-rezende'))!.bio).toEqual(['Escultor.'])
    // the other gallery edits its own page, which does not touch gallery A
    expect((await galleryPut(json('/x', 'PUT', { name: 'Casa Tamarindo' }))).status).toBe(200)
    expect(await prisma.galleryPublicProfile.findMany({ select: { tenantId: true } })).toEqual([{ tenantId: otherGallery.tenantId }])
  }, 60_000)
})

describe('cleanup', () => {
  it('removes the files written to public/uploads', () => {
    for (const f of written) if (existsSync(f)) rmSync(f)
    expect(true).toBe(true)
  })
})
