import { describe, expect, it } from 'vitest'
import { accountStateOf, canBlock, canChangeProfile, canSendReset, canSetProfile, filterKey, kpisOf, matchesFilter, outranks, parseQuery, type AdminUserRow } from './core'

const row = (p: Partial<AdminUserRow>): AdminUserRow => ({ id: 1, name: 'Ana', email: 'ana@x.test', profile: 'member', profileLabel: 'Membro', kinds: ['ARTIST'], active: true, state: 'ACTIVE', emailVerified: true, phoneVerified: false, hasPassword: true, socialLogins: [], member: null, kyc: null, pendingInvite: null, lastLoginAt: null, createdAt: '2026-10-01T12:00:00Z', can: { block: false, profile: false, reset: false, invite: false }, ...p })
const admin = { id: 1, profile: 'admin' }
const manager = { id: 2, profile: 'manager' }

describe('admin users core', () => {
  it('query: text or #id', () => {
    expect(parseQuery(' ana ')).toEqual({ text: 'ana', id: null })
    expect(parseQuery('#42')).toEqual({ text: '#42', id: 42 })
    expect(parseQuery('42')).toEqual({ text: '42', id: 42 })
    expect(filterKey('nope')).toBe('all')
  })
  it('filters and kpis', () => {
    const rows = [
      row({ id: 1, profile: 'admin', kinds: ['STAFF'] }),
      row({ id: 2, profile: 'member', kinds: ['GALLERY'], member: { kind: 'GALLERY_STAFF', status: 'PENDING', tenant: 'G', role: 'ADMIN' } }),
      row({ id: 3, profile: 'collector', kinds: ['COLLECTOR'], active: false, state: 'BLOCKED' }),
      row({ id: 4, profile: 'collector', kinds: ['COLLECTOR'], active: false, state: 'DELETION', emailVerified: false }),
    ]
    const ids = (f: Parameters<typeof matchesFilter>[1]) => rows.filter((r) => matchesFilter(r, f)).map((r) => r.id)
    expect(ids('staff')).toEqual([1]); expect(ids('members')).toEqual([2]); expect(ids('collectors')).toEqual([3, 4])
    expect(ids('blocked')).toEqual([3, 4]); expect(ids('deletion')).toEqual([4]); expect(ids('unverified')).toEqual([4]); expect(ids('all')).toHaveLength(4)
    expect(kpisOf(rows)).toEqual({ total: 4, staff: 1, blocked: 2, deletion: 1, pendingMembers: 1 })
    // the self-service deletion blocks the account AND marks the request: the request is what the desk reads
    expect(accountStateOf({ active: false, deletionRequestedAt: new Date() })).toBe('DELETION')
    expect(accountStateOf({ active: false, deletionRequestedAt: null })).toBe('BLOCKED')
  })
  it('who touches whom', () => {
    const member = { id: 9, profile: 'member', active: true }
    const otherAdmin = { id: 7, profile: 'admin', active: true }
    expect(outranks(admin, member)).toBe(true)
    expect(outranks(admin, { ...admin, active: true })).toBe(false) // never themself
    expect(outranks(manager, otherAdmin)).toBe(false)
    expect(outranks(manager, { id: 8, profile: 'manager', active: true })).toBe(false)
    expect(outranks(manager, member)).toBe(true)
    // the last active admin is never blocked; another admin is, by the admin only
    expect(canBlock(admin, otherAdmin, 1)).toBe(false)
    expect(canBlock(admin, otherAdmin, 2)).toBe(true)
    expect(canBlock(admin, { ...otherAdmin, active: false }, 1)).toBe(true) // unblocking never counts
    expect(canBlock(admin, { ...member, active: false, deletionRequested: true }, 1)).toBe(false) // never reopened here
    expect(canChangeProfile(admin, otherAdmin, 1)).toBe(false)
    expect(canChangeProfile(admin, otherAdmin, 2)).toBe(true)
    expect(canChangeProfile(admin, { id: 5, profile: 'finance', active: true }, 1)).toBe(true)
    // staff profile: admin only, staff targets only, between staff profiles, last admin stays admin
    expect(canSetProfile(admin, otherAdmin, 'manager', 2)).toBe(true)
    expect(canSetProfile(admin, otherAdmin, 'manager', 1)).toBe(false)
    expect(canSetProfile(admin, { id: 5, profile: 'finance', active: true }, 'operator', 1)).toBe(true)
    expect(canSetProfile(admin, member, 'operator', 1)).toBe(false)
    expect(canSetProfile(admin, { id: 5, profile: 'finance', active: true }, 'member', 1)).toBe(false)
    expect(canSetProfile(manager, { id: 5, profile: 'finance', active: true }, 'operator', 1)).toBe(false)
    expect(canSendReset(admin, member)).toBe(true)
    expect(canSendReset(admin, { ...member, active: false })).toBe(false)
  })
})
