// The mobile apps authenticate by bearer: the middleware must let it reach the API routes
// (getSession validates it there) and must not let it open the web pages.
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const TOKEN = 'a'.repeat(64)
const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`https://x.test${path}`, { headers })

describe('middleware and the bearer of the apps', () => {
  it('passes a well-formed bearer on /api/', () => {
    expect(middleware(req('/api/collector/wallet', { authorization: `Bearer ${TOKEN}` })).status).toBe(200)
  })
  it('refuses /api/ without cookie or bearer, and a malformed bearer', () => {
    expect(middleware(req('/api/collector/wallet')).status).toBe(401)
    expect(middleware(req('/api/collector/wallet', { authorization: 'Bearer abc' })).status).toBe(401)
  })
  it('a bearer does not open web pages', () => {
    expect(middleware(req('/wallet', { authorization: `Bearer ${TOKEN}` })).status).toBe(307)
  })
})
