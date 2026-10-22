import { describe, expect, it } from 'vitest'
import { authorizeUrl, challengeOf, configuredProviders, decideOAuth, decodeJwtPayload, mockAllowed, providerOfSlug, stateFresh, type OAuthState } from './core'

const state: OAuthState = { nonce: 'n', provider: 'GOOGLE', purpose: 'login', profileKind: null, plan: null, next: null, verifier: 'v'.repeat(43), issuedAt: 1_000 }

describe('oauth core', () => {
  it('maps slugs and refuses unknown providers', () => {
    expect(providerOfSlug('google')).toBe('GOOGLE')
    expect(providerOfSlug('Apple')).toBe('APPLE')
    expect(providerOfSlug('twitter')).toBeNull()
  })
  it('MOCK only outside production with OAUTH_MOCK=1', () => {
    expect(mockAllowed({ OAUTH_MOCK: '1', NODE_ENV: 'test' })).toBe(true)
    expect(mockAllowed({ OAUTH_MOCK: '1', NODE_ENV: 'production' })).toBe(false)
    expect(mockAllowed({ OAUTH_MOCK: '1', NODE_ENV: 'test', VERCEL_ENV: 'production' })).toBe(false)
    expect(mockAllowed({ NODE_ENV: 'test' })).toBe(false)
  })
  it('lists only configured providers', () => {
    expect(configuredProviders({ OAUTH_GOOGLE_CLIENT_ID: 'a', OAUTH_GOOGLE_CLIENT_SECRET: 'b', OAUTH_APPLE_CLIENT_ID: 'x' })).toEqual(['GOOGLE'])
  })
  it('builds the Google URL with PKCE and the state nonce', () => {
    const u = new URL(authorizeUrl('GOOGLE', { clientId: 'cid', clientSecret: 's' }, 'https://x/cb', state, 'https://x'))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('client_id')).toBe('cid')
    expect(u.searchParams.get('state')).toBe('n')
    expect(u.searchParams.get('code_challenge')).toBe(challengeOf(state.verifier))
    expect(u.searchParams.get('scope')).toContain('email')
  })
  it('MOCK goes to the local page', () => {
    expect(authorizeUrl('MOCK', { clientId: 'm', clientSecret: 'm' }, 'http://l/cb', { ...state, provider: 'MOCK' }, 'http://l')).toMatch(/^http:\/\/l\/api\/auth\/oauth\/mock\/authorize\?/)
  })
  it('state expires after 10 min', () => {
    expect(stateFresh(state, 1_000 + 9 * 60_000)).toBe(true)
    expect(stateFresh(state, 1_000 + 11 * 60_000)).toBe(false)
    expect(stateFresh(state, 0)).toBe(false)
  })
  it('decodes a JWT payload without verifying', () => {
    const payload = Buffer.from(JSON.stringify({ sub: '1', email: 'a@b.c' })).toString('base64url')
    expect(decodeJwtPayload(`h.${payload}.s`)).toEqual({ sub: '1', email: 'a@b.c' })
    expect(decodeJwtPayload('nope')).toBeNull()
  })
  const id = { provider: 'GOOGLE' as const, providerUserId: 'g1', email: 'a@b.c', emailVerified: true, name: 'A' }
  const self = ['ARTIST', 'GALLERY', 'ADVISOR', 'COLLECTOR']
  it('linked identity logs in; inactive refuses', () => {
    expect(decideOAuth({ purpose: 'login', identity: id, linked: { userId: 7, active: true }, byEmail: null, profileKind: null, selfSignup: self })).toEqual({ kind: 'login', userId: 7 })
    expect(decideOAuth({ purpose: 'login', identity: id, linked: { userId: 7, active: false }, byEmail: null, profileKind: null, selfSignup: self })).toEqual({ kind: 'inactive' })
  })
  it('same verified e-mail links; unverified e-mail never adopts an account', () => {
    expect(decideOAuth({ purpose: 'login', identity: id, linked: null, byEmail: { userId: 3, active: true }, profileKind: null, selfSignup: self })).toEqual({ kind: 'link', userId: 3 })
    expect(decideOAuth({ purpose: 'signup', identity: { ...id, emailVerified: false }, linked: null, byEmail: { userId: 3, active: true }, profileKind: 'ARTIST', selfSignup: self })).toEqual({ kind: 'no-account' })
  })
  it('signup with a self-signup profile creates; login of unknown e-mail does not', () => {
    expect(decideOAuth({ purpose: 'signup', identity: id, linked: null, byEmail: null, profileKind: 'ARTIST', selfSignup: self })).toEqual({ kind: 'create', profileKind: 'ARTIST' })
    expect(decideOAuth({ purpose: 'signup', identity: id, linked: null, byEmail: null, profileKind: 'STAFF', selfSignup: self })).toEqual({ kind: 'no-account' })
    expect(decideOAuth({ purpose: 'login', identity: id, linked: null, byEmail: null, profileKind: null, selfSignup: self })).toEqual({ kind: 'no-account' })
    expect(decideOAuth({ purpose: 'signup', identity: { ...id, email: null }, linked: null, byEmail: null, profileKind: 'ARTIST', selfSignup: self })).toEqual({ kind: 'no-email' })
  })
})
