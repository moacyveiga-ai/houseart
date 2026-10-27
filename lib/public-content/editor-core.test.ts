import { describe, expect, it } from 'vitest'
import {
  centsFromReais, contentImageVerdict, httpUrl, imageUrl, instagramHandle, isOwnContentImage, isoDay, newsState, nextPublishedAt,
  parseAgenda, parseArtistProfile, parseGalleryProfile, parseNews, priceCents, reaisOfCents, slugOf,
} from './editor-core'

const UP = '/api/public/media/content/news/1-abc.jpg'

describe('primitives', () => {
  it('links are http(s) only', () => {
    expect(httpUrl('https://exemplo.com/a', 'x')).toBe('https://exemplo.com/a')
    expect(httpUrl('  ', 'x')).toBeNull()
    expect(() => httpUrl('javascript:alert(1)', 'Link')).toThrow()
    expect(() => httpUrl('ftp://x.com', 'Link')).toThrow()
    expect(() => httpUrl('https://user:pw@x.com', 'Link')).toThrow()
  })
  it('images: own uploads, the stored value, nothing else', () => {
    expect(isOwnContentImage(UP)).toBe(true)
    expect(isOwnContentImage('/uploads/content/artists/3/x.jpg')).toBe(true)
    expect(isOwnContentImage('https://abc123.public.blob.vercel-storage.com/uploads/content/galleries/2/x.jpg')).toBe(true)
    expect(isOwnContentImage('/uploads/artworks/1/x.jpg')).toBe(false)
    expect(isOwnContentImage('/uploads/content/../x.jpg')).toBe(false)
    expect(isOwnContentImage('https://evil.com/uploads/content/x.jpg')).toBe(false)
    expect(imageUrl('https://old.example/x.jpg', 'Foto', new Set(['https://old.example/x.jpg']))).toBe('https://old.example/x.jpg')
    expect(() => imageUrl('https://other.example/x.jpg', 'Foto', new Set())).toThrow(/upload/)
    expect(imageUrl('', 'Foto', new Set())).toBeNull()
  })
  it('instagram, dates, prices', () => {
    expect(instagramHandle('@galeria.ladeira')).toBe('galeria.ladeira')
    expect(instagramHandle('https://www.instagram.com/ladeira/')).toBe('ladeira')
    expect(() => instagramHandle('não vale')).toThrow()
    expect(isoDay('2026-02-28', 'd')).toBe('2026-02-28')
    expect(() => isoDay('2026-02-30', 'd')).toThrow()
    expect(priceCents('4990', 'p')).toBe(4990n)
    expect(priceCents('0', 'p')).toBeNull()
    expect(() => priceCents('-1', 'p')).toThrow()
    expect(() => priceCents('49.9', 'p')).toThrow()
    expect(centsFromReais('R$ 49,90')).toBe('4990')
    expect(centsFromReais('1.250,5')).toBe('125050')
    expect(centsFromReais('49')).toBe('4900')
    expect(centsFromReais('')).toBe('')
    expect(centsFromReais('abc')).toBeNull()
    expect(reaisOfCents('4990')).toBe('49,90')
    expect(reaisOfCents(null)).toBe('')
    expect(slugOf('Minha Notícia!')).toBe('minha-noticia')
    expect(slugOf('  ')).toBeNull()
  })
  it('image intake verdict', () => {
    expect(contentImageVerdict('image/png', 100)).toEqual({ ok: true })
    expect(contentImageVerdict('image/svg+xml', 100)).toMatchObject({ ok: false, status: 415 })
    expect(contentImageVerdict('application/pdf', 100)).toMatchObject({ ok: false, status: 415 })
    expect(contentImageVerdict('image/jpeg', 11 * 1024 * 1024)).toMatchObject({ ok: false, status: 413 })
  })
})

describe('news', () => {
  it('normalizes and validates', () => {
    const r = parseNews({ title: '  Feira em Salvador ', category: 'Feiras', summary: '', body: 'a\n\nb', imageUrl: UP, featured: true, sourceUrl: 'https://fonte.com' })
    expect(r).toEqual({ ok: true, value: { title: 'Feira em Salvador', category: 'Feiras', slug: null, summary: null, body: 'a\n\nb', imageUrl: UP, sourceName: null, sourceUrl: 'https://fonte.com/', featured: true } })
    expect(parseNews({ title: 'Ok título', category: 'Leilão' })).toMatchObject({ ok: false, error: 'Categoria: opção inválida.' })
    expect(parseNews({ title: '', category: 'Feiras' })).toMatchObject({ ok: false })
    expect(parseNews({ title: 'x'.repeat(201), category: 'Feiras' })).toMatchObject({ ok: false })
  })
  it('publish keeps the first date; unpublish is a draft', () => {
    const first = new Date('2026-10-01T12:00:00Z')
    const now = new Date('2026-10-22T12:00:00Z')
    expect(nextPublishedAt(null, true, now)).toBe(now)
    expect(nextPublishedAt(first, true, now)).toBe(first)
    expect(nextPublishedAt(first, false, now)).toBeNull()
    expect(newsState(null, now)).toBe('DRAFT')
    expect(newsState(first, now)).toBe('PUBLISHED')
    expect(newsState(new Date('2026-11-01T00:00:00Z'), now)).toBe('SCHEDULED')
  })
})

describe('agenda', () => {
  it('dates and kinds', () => {
    const ok = parseAgenda({ kind: 'FAIR', title: 'SP-Arte', venue: 'Bienal', city: 'São Paulo/SP', startsOn: '2026-11-05', endsOn: '2026-11-09' })
    expect(ok).toMatchObject({ ok: true, value: { kind: 'FAIR', endsOn: '2026-11-09', period: null, url: null } })
    expect(parseAgenda({ kind: 'FAIR', title: 'SP-Arte', venue: 'B', city: 'C', startsOn: '2026-11-05', endsOn: '2026-11-01' })).toMatchObject({ ok: false, error: 'Fim: não pode ser antes do início.' })
    expect(parseAgenda({ kind: 'PARTY', title: 'SP-Arte', venue: 'B', city: 'C', startsOn: '2026-11-05' })).toMatchObject({ ok: false })
    expect(parseAgenda({ kind: 'FAIR', title: 'SP-Arte', venue: 'B', city: 'C' })).toMatchObject({ ok: false, error: 'Início: obrigatório.' })
  })
})

describe('artist profile', () => {
  it('languages deduplicated, entries ordered per kind, photo credit only with a photo', () => {
    const r = parseArtistProfile({
      bio: 'Bio', languages: ['Pintura', 'Pintura', ' Óleo '], photoUrl: null, photoCredit: 'Foto: X',
      entries: [{ kind: 'SOLO', year: '2026', title: 'A' }, { kind: 'AWARD', year: '2020', title: 'B' }, { kind: 'SOLO', year: '2024', title: 'C', venue: 'MAM' }],
      publications: [{ kind: 'CATALOGUE', title: 'Cat', priceCents: '4990', action: 'BUY', coverUrl: UP }, { kind: 'ESSAY', title: 'Ensaio' }],
    })
    if (!r.ok) throw new Error(r.error)
    expect(r.value.profile.languagesJson).toBe('["Pintura","Óleo"]')
    expect(r.value.profile.photoCredit).toBeNull()
    expect(r.value.entries.map((e) => [e.kind, e.sortOrder])).toEqual([['SOLO', 0], ['AWARD', 0], ['SOLO', 1]])
    expect(r.value.publications[0]).toMatchObject({ priceCents: 4990n, action: 'BUY', sortOrder: 0 })
    expect(r.value.publications[1]).toMatchObject({ priceCents: null, action: 'READ', sortOrder: 1 })
  })
  it('refuses unknown kinds, missing titles and foreign images', () => {
    expect(parseArtistProfile({ entries: [{ kind: 'PARTY', year: '1', title: 'x' }] })).toMatchObject({ ok: false })
    expect(parseArtistProfile({ entries: [{ kind: 'SOLO', year: '2026', title: '' }] })).toMatchObject({ ok: false, error: 'Trajetória, linha 1 · título: obrigatório.' })
    expect(parseArtistProfile({ photoUrl: 'https://tracker.example/p.gif' })).toMatchObject({ ok: false })
    expect(parseArtistProfile({ entries: Array.from({ length: 201 }, () => ({ kind: 'SOLO', year: '1', title: 'x' })) })).toMatchObject({ ok: false })
  })
})

describe('gallery profile', () => {
  it('normalizes contacts, map and items', () => {
    const r = parseGalleryProfile({
      name: 'Galeria Ladeira', uf: 'ba', foundedYear: '2009', tags: ['Contemporânea'], lat: '-12,97', lng: -38.51, instagram: '@ladeira', email: 'Contato@Ladeira.ART', phone: '(71) 3333-0000',
      items: [{ kind: 'MILESTONE', title: 'Fundação', subtitle: '2009', url: 'https://ignored.example' }, { kind: 'VIDEO', title: 'Tour', url: 'https://youtu.be/x' }, { kind: 'PHOTO', title: 'Sala 1', url: UP }],
    }, new Set(), 2027)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.profile).toMatchObject({ uf: 'BA', foundedYear: 2009, lat: -12.97, lng: -38.51, instagram: 'ladeira', email: 'contato@ladeira.art', tagsJson: '["Contemporânea"]' })
    expect(r.value.items.map((i) => i.url)).toEqual([null, 'https://youtu.be/x', UP])
  })
  it('refuses half a coordinate, a bad UF and a future founding year', () => {
    expect(parseGalleryProfile({ name: 'G', lat: 1 })).toMatchObject({ ok: false })
    expect(parseGalleryProfile({ name: 'Galeria', lat: 1 })).toMatchObject({ ok: false, error: 'Mapa: informe latitude e longitude juntas (ou nenhuma).' })
    expect(parseGalleryProfile({ name: 'Galeria', uf: 'B1' })).toMatchObject({ ok: false })
    expect(parseGalleryProfile({ name: 'Galeria', foundedYear: 2090 }, new Set(), 2027)).toMatchObject({ ok: false })
    expect(parseGalleryProfile({ name: 'Galeria', items: [{ kind: 'TEAM', title: 'Ana', url: 'https://x.example/a.jpg' }] })).toMatchObject({ ok: false })
  })
  it('keeps bio, e-mail and phone only for a team member', () => {
    const r = parseGalleryProfile({ name: 'Galeria', items: [
      { kind: 'TEAM', title: 'Ana', body: 'Curadora.', email: 'Ana@Galeria.com', phone: '(71) 3333-4444' },
      { kind: 'MILESTONE', title: 'Fundação', subtitle: '1998', body: 'x', email: 'a@b.com' },
    ] })
    expect(r).toMatchObject({ ok: true, value: { items: [
      { kind: 'TEAM', body: 'Curadora.', email: 'ana@galeria.com', phone: '(71) 3333-4444' },
      { kind: 'MILESTONE', body: null, email: null, phone: null },
    ] } })
    expect(parseGalleryProfile({ name: 'Galeria', items: [{ kind: 'TEAM', title: 'Ana', email: 'nao-e-email' }] })).toMatchObject({ ok: false })
  })
})
