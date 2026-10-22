import { describe, expect, it } from 'vitest'
import { looksLikePublicId, normalizeQuery } from './core'

describe('search core', () => {
  it('normalizes and detects public ids', () => {
    expect(normalizeQuery('  joana   teixeira ')).toBe('joana teixeira')
    expect(normalizeQuery(null)).toBe('')
    expect(looksLikePublicId('HA-2025-2B8D-4R1X')).toBe(true)
    expect(looksLikePublicId('ha20252b8d4r1x')).toBe(true)
    expect(looksLikePublicId('Joana')).toBe(false)
  })
})
