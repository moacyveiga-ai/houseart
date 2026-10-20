import { describe, expect, it } from 'vitest'
import {
  canView, memberFilter, memberOrRelationFilter, NONE_SCOPE, NOTHING, relationFilter,
  scopeOfUser, tenantColleaguesFilter, tenantFilter, TOTAL_SCOPE, tenantViaMemberFilter,
} from './core'

const staff = (p: string) => p === 'admin'

describe('scopeOfUser', () => {
  it('staff → total', () => {
    expect(scopeOfUser({ profile: 'admin', memberId: null }, staff)).toEqual(TOTAL_SCOPE)
  })
  it('ADMIN of a tenant → tenant, with own memberId', () => {
    expect(scopeOfUser({ profile: 'gallery', memberId: 3, tenantId: 7, tenantRole: 'ADMIN' }, staff))
      .toEqual({ kind: 'tenant', tenantId: 7, memberId: 3 })
  })
  it('tenant level off → ADMIN falls to member', () => {
    expect(scopeOfUser({ profile: 'gallery', memberId: 3, tenantId: 7, tenantRole: 'ADMIN' }, staff, { tenantLevel: false }))
      .toEqual({ kind: 'member', memberId: 3, tenantId: 7 })
  })
  it('without memberId → none (fail-closed), including ADMIN without tenant', () => {
    expect(scopeOfUser({ profile: 'artist', memberId: null }, staff)).toEqual(NONE_SCOPE)
    expect(scopeOfUser({ profile: 'gallery', memberId: 0, tenantId: null, tenantRole: 'ADMIN' }, staff)).toEqual(NONE_SCOPE)
    expect(scopeOfUser(null, staff)).toEqual(NONE_SCOPE)
  })
})

describe('filters', () => {
  const member = { kind: 'member', memberId: 5, tenantId: 9 } as const
  const tenant = { kind: 'tenant', tenantId: 9, memberId: 5 } as const
  it('memberFilter', () => {
    expect(memberFilter(TOTAL_SCOPE)).toEqual({})
    expect(memberFilter(NONE_SCOPE)).toEqual(NOTHING)
    expect(memberFilter(member)).toEqual({ memberId: 5 })
    expect(memberFilter(tenant)).toEqual({ tenantId: 9 })
  })
  it('relationFilter and memberOrRelationFilter', () => {
    expect(relationFilter(member, 'artwork')).toEqual({ artwork: { memberId: 5 } })
    expect(relationFilter(tenant, 'artwork')).toEqual({ artwork: { tenantId: 9 } })
    expect(memberOrRelationFilter(member, 'artwork')).toEqual({ AND: [{ OR: [{ memberId: 5 }, { artwork: { memberId: 5 } }] }] })
  })
  it('tenantViaMemberFilter / tenantFilter / colleagues', () => {
    expect(tenantViaMemberFilter(tenant)).toEqual({ member: { tenantId: 9 } })
    expect(tenantFilter({ kind: 'member', memberId: 5, tenantId: null })).toEqual(NOTHING)
    expect(tenantColleaguesFilter({ kind: 'member', memberId: 5, tenantId: null })).toEqual({ id: 5 })
    expect(tenantColleaguesFilter(tenant)).toEqual({ OR: [{ tenantId: 9 }, { id: 5 }] })
  })
  it('NOTHING is never the same object', () => {
    expect(memberFilter(NONE_SCOPE)).not.toBe(NOTHING)
  })
})

describe('canView', () => {
  it('tenant sees by column or by member relation; member only own', () => {
    const tenant = { kind: 'tenant', tenantId: 9, memberId: null } as const
    expect(canView(tenant, { tenantId: 9 })).toBe(true)
    expect(canView(tenant, { member: { tenantId: 9 } })).toBe(true)
    expect(canView(tenant, { tenantId: 8 })).toBe(false)
    expect(canView({ kind: 'member', memberId: 5, tenantId: 9 }, { memberId: 6, tenantId: 9 })).toBe(false)
    expect(canView(NONE_SCOPE, { memberId: 5 })).toBe(false)
    expect(canView(TOTAL_SCOPE, null)).toBe(false)
  })
})
