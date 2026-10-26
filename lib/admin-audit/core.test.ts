import { describe, expect, it } from 'vitest'
import { compact, hrefOf, parseQuery, queryString, rangeOf, whoIdOf } from './core'

describe('admin audit core', () => {
  it('parses the URL and prints it back', () => {
    const q = parseQuery({ entity: ' User ', id: '42', action: 'BLOCK', who: 'Ana', from: '2026-10-01', to: 'nope', page: '3' })
    expect(q).toEqual({ entity: 'user', entityId: '42', action: 'block', who: 'Ana', from: '2026-10-01', to: '', page: 3 })
    expect(parseQuery({ page: '-4' }).page).toBe(1)
    expect(parseQuery({ page: '9999' }).page).toBe(200)
    expect(parseQuery({ from: '2026-13-01', to: '2026-02-30' })).toMatchObject({ from: '', to: '' }) // not real days
    expect(whoIdOf('#42')).toBe(42); expect(whoIdOf('42')).toBe(42); expect(whoIdOf('#99999999999')).toBeNull(); expect(whoIdOf('Ana')).toBeNull()
    expect(queryString(q)).toBe('?entity=user&id=42&action=block&who=Ana&from=2026-10-01&page=3')
    expect(queryString({ page: 1 })).toBe('')
  })
  it('range in the house time zone, cut at 92 days', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    const r = rangeOf({ from: '2026-10-01', to: '2026-10-02' }, now)
    expect(r.from?.toISOString()).toBe('2026-10-01T03:00:00.000Z'); expect(r.to?.toISOString()).toBe('2026-10-03T02:59:59.999Z'); expect(r.cut).toBe(false)
    const wide = rangeOf({ from: '2026-01-01', to: '2026-10-01' }, now)
    expect(wide.cut).toBe(true); expect(wide.to?.toISOString()).toBe('2026-04-03T03:00:00.000Z')
    expect(rangeOf({ from: '', to: '' }, now)).toEqual({ from: null, to: null, cut: false })
  })
  it('links and compaction', () => {
    expect(hrefOf('artwork', '7')).toBeNull() // no desk screen for the artwork yet
    expect(hrefOf('user', '3')).toBe('/admin/users?q=%233')
    expect(hrefOf('kyc_verification', '9')).toBe('/admin/kyc?f=all')
    expect(hrefOf('whatever', '1')).toBeNull()
    expect(compact(null)).toBeNull()
    expect(compact('{ "a":\n 1 }')).toBe('{ "a": 1 }')
    expect(compact('x'.repeat(200))).toHaveLength(160)
  })
})
