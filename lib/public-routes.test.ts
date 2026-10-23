import { describe, expect, it } from 'vitest'
import { isPublicRoute, unauthenticatedDestination } from './public-routes'

describe('public routes', () => {
  it('lets the public doors through and keeps the panel closed', () => {
    for (const p of ['/login', '/e', '/e/artwork/HA-2026-AAAA-BBBB', '/verify', '/verify/HA-1', '/a/HA-1', '/api/public/offers', '/api/cron/certificate-anchor', '/api/auth/login', '/collector/access', '/api/collector/access/start', '/api/stripe/webhook'])
      expect(isPublicRoute(p), p).toBe(true)
    for (const p of ['/', '/dashboard', '/artworks', '/api/artworks', '/api/collector/wallet', '/admin/markers', '/collector/wallet', '/api/stripe/webhook/x', '/api/collector/payment-methods/setup'])
      expect(isPublicRoute(p), p).toBe(false)
  })

  it('sends the root to the market, the collector area to its door, the rest to /login with next', () => {
    expect(unauthenticatedDestination('/', '?ref=x')).toEqual({ pathname: '/e', search: '' })
    expect(unauthenticatedDestination('/collector/wallet', '')).toEqual({ pathname: '/collector/access', search: '?next=%2Fcollector%2Fwallet' })
    expect(unauthenticatedDestination('/artworks', '?f=1')).toEqual({ pathname: '/login', search: '?next=%2Fartworks%3Ff%3D1' })
  })
})
