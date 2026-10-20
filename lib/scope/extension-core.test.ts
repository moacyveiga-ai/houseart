import { describe, expect, it } from 'vitest'
import { decideQuery, KeyDedupe, watchedQuery, whereMentionsOwner } from './extension-core'

const scoped = { scope: { kind: 'member', memberId: 1, tenantId: null }, origin: 'test' } as const

describe('scope extension core', () => {
  it('watches only hot models in list operations', () => {
    expect(watchedQuery('Artwork', 'findMany')).toBe(true)
    expect(watchedQuery('Artwork', 'findUnique')).toBe(false)
    expect(watchedQuery('AuditLog', 'findMany')).toBe(false)
  })
  it('finds owner keys at any depth', () => {
    expect(whereMentionsOwner({ status: 'LISTED' })).toBe(false)
    expect(whereMentionsOwner({ AND: [{ OR: [{ artwork: { memberId: 1 } }] }] })).toBe(true)
  })
  it('decides throw in dev/test, log in production, allow for total or no context', () => {
    const base = { model: 'Artwork', operation: 'findMany', where: {} }
    expect(decideQuery({ ...base, context: scoped, environment: 'test' })).toBe('throw')
    expect(decideQuery({ ...base, context: scoped, environment: 'production' })).toBe('log')
    expect(decideQuery({ ...base, context: undefined, environment: 'test' })).toBe('allow')
    expect(decideQuery({ ...base, context: { scope: { kind: 'total' }, origin: 'job' }, environment: 'test' })).toBe('allow')
    expect(decideQuery({ ...base, where: { memberId: 1 }, context: scoped, environment: 'test' })).toBe('allow')
  })
  it('KeyDedupe caps and expires', () => {
    const d = new KeyDedupe(2, 100)
    expect(d.firstTime('a', 0)).toBe(true)
    expect(d.firstTime('a', 50)).toBe(false)
    expect(d.firstTime('a', 200)).toBe(true)
    d.firstTime('b', 200); d.firstTime('c', 200)
    expect(d.size).toBe(2)
  })
})
