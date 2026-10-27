import { describe, expect, it } from 'vitest'
import { checkComment, checkPost, dayMonthOf, pollResult, profileHrefOf, reactionAllowed } from './domain'

describe('community domain', () => {
  it('validates posts by kind', () => {
    expect(checkPost({ kind: 'TEXT', body: '  olá ' })).toMatchObject({ ok: true, value: { body: 'olá' } })
    expect(checkPost({ kind: 'TEXT', body: '' })).toMatchObject({ ok: false })
    expect(checkPost({ kind: 'PHOTO', body: 'x' })).toMatchObject({ ok: false })
    expect(checkPost({ kind: 'PHOTO', body: 'x', artworkId: 3 })).toMatchObject({ ok: true })
    expect(checkPost({ kind: 'POLL', body: 'Qual?', pollOptions: ['A'] })).toMatchObject({ ok: false })
    expect(checkPost({ kind: 'POLL', body: 'Qual?', pollOptions: ['A', 'a'] })).toMatchObject({ ok: false })
    expect(checkPost({ kind: 'POLL', body: 'Qual?', pollOptions: ['Pintura', 'Foto'] })).toMatchObject({ ok: true, value: { pollOptions: ['Pintura', 'Foto'] } })
    expect(checkPost({ kind: 'EVENT', body: '', event: { title: 'Abertura', venue: 'Galeria', startsOn: '2026-10-24', startsAt: '19h' } })).toMatchObject({ ok: true })
    expect(checkPost({ kind: 'EVENT', body: '', event: { title: 'Abertura', venue: 'Galeria', startsOn: '24/10' } })).toMatchObject({ ok: false })
    expect(checkPost({ kind: 'X', body: 'x' })).toMatchObject({ ok: false })
  })
  it('comments, reactions, polls, dates', () => {
    expect(checkComment(' bom ')).toEqual({ ok: true, body: 'bom' })
    expect(checkComment('a'.repeat(501))).toMatchObject({ ok: false })
    expect(reactionAllowed('POST', 'LIKE')).toBe(true)
    expect(reactionAllowed('POST', 'RSVP')).toBe(true)
    expect(reactionAllowed('NEWS', 'RSVP')).toBe(false)
    expect(reactionAllowed('MEMBER', 'FOLLOW')).toBe(true)
    expect(pollResult(['A', 'B'], [3, 1])).toEqual([{ label: 'A', count: 3, pct: 75 }, { label: 'B', count: 1, pct: 25 }])
    expect(pollResult(['A'], [])).toEqual([{ label: 'A', count: 0, pct: 0 }])
    expect(dayMonthOf('2026-10-29')).toEqual({ day: '29', month: 'OUT' })
  })
})

describe('profileHrefOf', () => {
  it('artist and active gallery have a page; collector, consultant and suspended gallery do not', () => {
    expect(profileHrefOf({ kind: 'ARTIST', artistSlug: 'joana', gallerySlug: null, tenantActive: true })).toBe('/e/artist/joana')
    expect(profileHrefOf({ kind: 'GALLERY_STAFF', artistSlug: null, gallerySlug: 'casa', tenantActive: true })).toBe('/e/gallery/casa')
    expect(profileHrefOf({ kind: 'GALLERY_STAFF', artistSlug: null, gallerySlug: 'casa', tenantActive: false })).toBeNull()
    expect(profileHrefOf({ kind: 'COLLECTOR', artistSlug: null, gallerySlug: null, tenantActive: true })).toBeNull()
    expect(profileHrefOf({ kind: 'ARTIST', artistSlug: null, gallerySlug: null, tenantActive: true })).toBeNull()
    expect(profileHrefOf(null)).toBeNull()
  })
})
