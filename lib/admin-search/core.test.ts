import { describe, expect, it } from 'vitest'
import { canonicalDealCode, canonicalPublicId, idOf, termKindOf } from './core'

describe('admin search core', () => {
  it('reads the term', () => {
    expect(termKindOf('HA-2026-AB12-CD34')).toBe('certificate'); expect(canonicalPublicId('ha2026ab12cd34')).toBe('HA-2026-AB12-CD34')
    expect(termKindOf('DL-2026-000012')).toBe('deal'); expect(canonicalDealCode('dl-2026-12')).toBe('DL-2026-000012')
    expect(termKindOf('#42')).toBe('id'); expect(idOf('#42')).toBe(42); expect(idOf('42')).toBeNull()
    expect(termKindOf('lia@col.test')).toBe('email')
    expect(termKindOf('Joana')).toBe('text'); expect(canonicalPublicId('Joana')).toBeNull(); expect(canonicalDealCode('Joana')).toBeNull()
  })
})
