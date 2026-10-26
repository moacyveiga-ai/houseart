import { describe, expect, it } from 'vitest'
import { audienceOf, canGrantPlan, canReinstate, canSuspend, kpisOf, matchesFilter, parseQuery } from './core'

const row = (p: Partial<{ kind: string; status: string; paid: boolean; sub: 'ACTIVE' | 'PAST_DUE' | 'DEFAULT'; invites: number }> = {}) => ({ kind: p.kind ?? 'GALLERY', status: p.status ?? 'ACTIVE', plan: { code: 'GALLERY', name: 'Galeria', priceCents: '34900', subscription: p.sub ?? 'DEFAULT', periodEnd: null, paid: p.paid ?? false }, team: { admin: 1, sales: 0, inventory: 0, pendingInvites: p.invites ?? 0 } })

describe('admin tenants core', () => {
  it('reads the query as #id or text', () => {
    expect(parseQuery('#12')).toEqual({ id: 12, text: '' })
    expect(parseQuery(' Ladeira ')).toEqual({ id: null, text: 'Ladeira' })
    expect(parseQuery('#1234567890')).toEqual({ id: null, text: '#1234567890' })
  })
  it('filters and counts', () => {
    const rows = [row(), row({ kind: 'PERSON', paid: true, sub: 'ACTIVE' }), row({ status: 'SUSPENDED', invites: 2 }), row({ kind: 'PERSON', sub: 'PAST_DUE', paid: true })]
    expect(rows.filter((r) => matchesFilter(r, 'galleries')).length).toBe(2)
    expect(rows.filter((r) => matchesFilter(r, 'persons')).length).toBe(2)
    expect(rows.filter((r) => matchesFilter(r, 'paid')).length).toBe(2)
    expect(rows.filter((r) => matchesFilter(r, 'suspended')).length).toBe(1)
    expect(kpisOf(rows)).toEqual({ galleries: 2, persons: 2, paid: 2, pastDue: 1, suspended: 1, pendingInvites: 2 })
  })
  it('only admin and manager act, and only in the right state', () => {
    const adm = { profile: 'manager' }, op = { profile: 'operator' }
    expect(canGrantPlan(adm, row())).toBe(true)
    expect(canGrantPlan(op, row())).toBe(false)
    expect(canGrantPlan(adm, row({ status: 'SUSPENDED' }))).toBe(false)
    expect(canSuspend(adm, row())).toBe(true)
    expect(canSuspend(adm, row({ status: 'SUSPENDED' }))).toBe(false)
    expect(canReinstate(adm, row({ status: 'SUSPENDED' }))).toBe(true)
    expect(canReinstate(adm, row())).toBe(false)
  })
  it('derives the plan audience', () => {
    expect(audienceOf('GALLERY', [])).toBe('GALLERY')
    expect(audienceOf('PERSON', ['ARTIST'])).toBe('ARTIST')
    expect(audienceOf('PERSON', ['ADVISOR'])).toBe('ADVISOR')
    expect(audienceOf('PERSON', ['COLLECTOR'])).toBe('ARTIST')
  })
})
