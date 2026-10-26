import { describe, expect, it } from 'vitest'
import { headerSearchTarget } from './header-search-core'

describe('headerSearchTarget', () => {
  it('opens the verification of a full id', () => {
    expect(headerSearchTarget(' ha-2026-ab12-cd34 ')).toBe('/verify/HA-2026-AB12-CD34')
  })
  it('searches the verification for a partial id', () => {
    expect(headerSearchTarget('HA-2026')).toBe('/verify?id=HA-2026')
  })
  it('searches the marketplace for the rest, and ignores an empty box', () => {
    expect(headerSearchTarget('Lia Santana')).toBe('/e/marketplace?q=Lia%20Santana')
    expect(headerSearchTarget('   ')).toBeNull()
  })
})
