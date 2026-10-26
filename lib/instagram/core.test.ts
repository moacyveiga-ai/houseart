import { describe, expect, it } from 'vitest'
import { authorizeUrl, CAPTION_MAX, captionOf, followersLabel, handleOf, instagramMode, needsRefresh, publicationStats, publishBlocker, stateValid } from './core'

describe('instagram core', () => {
  it('mode: LIVE with both keys, MOCK only outside production, else OFF', () => {
    expect(instagramMode({ INSTAGRAM_APP_ID: 'a', INSTAGRAM_APP_SECRET: 'b' })).toBe('LIVE')
    expect(instagramMode({ INSTAGRAM_APP_ID: 'a' })).toBe('OFF')
    expect(instagramMode({ INSTAGRAM_MOCK: '1', NODE_ENV: 'test' })).toBe('MOCK')
    expect(instagramMode({ INSTAGRAM_MOCK: '1', NODE_ENV: 'production' })).toBe('OFF')
    expect(instagramMode({ INSTAGRAM_MOCK: '1', VERCEL_ENV: 'production' })).toBe('OFF')
  })

  it('authorize URL carries the business scopes and the state', () => {
    const u = new URL(authorizeUrl('LIVE', 'app1', 'https://x.test/api/instagram/callback', 'n1', 'https://x.test'))
    expect(u.host).toBe('www.instagram.com')
    expect(u.searchParams.get('scope')).toContain('instagram_business_content_publish')
    expect(u.searchParams.get('state')).toBe('n1')
    expect(authorizeUrl('MOCK', '', '', 'n2', 'https://x.test')).toBe('https://x.test/api/instagram/mock/authorize?state=n2')
  })

  it('state: same nonce and person, within 10 minutes', () => {
    const s = { nonce: 'a', userId: 7, issuedAt: 1_000 }
    expect(stateValid(s, 'a', 7, 2_000)).toBe(true)
    expect(stateValid(s, 'b', 7, 2_000)).toBe(false)
    expect(stateValid(s, 'a', 8, 2_000)).toBe(false)
    expect(stateValid(s, 'a', 7, 1_000 + 11 * 60_000)).toBe(false)
  })

  it('handle and labels', () => {
    expect(handleOf('Galeria Ladeira')).toBe('@galerialadeira')
    expect(handleOf('joão.silva_')).toBe('@joao.silva_')
    expect(followersLabel(12_400)).toBe('12,4 mil seguidores')
    expect(followersLabel(1)).toBe('1 seguidor')
  })

  it('caption: text, artwork, tag, link and hashtags, always within 2,200', () => {
    const c = captionOf({ body: 'Nova na parede', artwork: { title: 'Mar de dentro', artist: 'Joana' }, artistHandle: '@joana', tagArtist: true, link: 'https://x.test/api/public/ig/abc' })
    expect(c).toBe('Nova na parede\n\nMar de dentro, Joana @joana\nVeja na HouseArt: https://x.test/api/public/ig/abc\n#arte #houseart')
    expect(captionOf({ body: 'x', artwork: { title: 'T', artist: 'A' }, artistHandle: '@a', tagArtist: false, link: null })).not.toContain('@a')
    const long = captionOf({ body: 'a'.repeat(5000), artwork: null, artistHandle: null, tagArtist: false, link: null })
    expect(long.length).toBeLessThanOrEqual(CAPTION_MAX)
    expect(long.endsWith('#arte #houseart')).toBe(true)
  })

  it('only posts with an image go to Instagram; polls never', () => {
    expect(publishBlocker({ kind: 'TEXT', imageUrl: null, hasArtworkImage: false })).toMatch(/imagem/)
    expect(publishBlocker({ kind: 'TEXT', imageUrl: null, hasArtworkImage: true })).toBeNull()
    expect(publishBlocker({ kind: 'POLL', imageUrl: 'https://x', hasArtworkImage: true })).toMatch(/Enquetes/)
    // a 3:4 portrait does not go to the feed, but goes to Stories
    expect(publishBlocker({ kind: 'TEXT', imageUrl: null, hasArtworkImage: true, format: 'FEED', image: { width: 900, height: 1200 } })).toMatch(/4:5/)
    expect(publishBlocker({ kind: 'TEXT', imageUrl: null, hasArtworkImage: true, format: 'STORIES', image: { width: 900, height: 1200 } })).toBeNull()
    expect(publishBlocker({ kind: 'TEXT', imageUrl: null, hasArtworkImage: true, format: 'BOTH', image: { width: 1080, height: 1350 } })).toBeNull()
  })

  it('stats line and token refresh window', () => {
    expect(publicationStats({ status: 'PUBLISHED', reach: 1240, clicks: 18, error: null })).toBe('1.240 alcançados · 18 visitas pelo link')
    expect(publicationStats({ status: 'FAILED', reach: 0, clicks: 0, error: 'O Instagram recusou o envio' })).toContain('recusou')
    const now = new Date('2026-10-26T00:00:00Z')
    expect(needsRefresh(new Date('2026-11-01T00:00:00Z'), now)).toBe(true)
    expect(needsRefresh(new Date('2026-12-20T00:00:00Z'), now)).toBe(false)
    expect(needsRefresh(null, now)).toBe(false)
  })
})
