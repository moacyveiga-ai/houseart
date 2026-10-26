import { describe, expect, it } from 'vitest'
import { canApprove, canReject, canRevalidate, filterKey, kpisOf, matchesFilter, stateOf, type AdminKycRow } from './core'

const now = new Date('2026-10-26T12:00:00Z')
const row = (p: Partial<AdminKycRow>): AdminKycRow => ({ id: 1, userId: 1, name: 'Lia', email: 'lia@x.test', profile: 'collector', provider: 'didit', providerLabel: 'Didit', state: 'PENDING', stateLabel: 'Na fila', scoreBps: null, pepHit: false, hasDocument: true, createdAt: '2026-10-01T12:00:00Z', verifiedAt: null, expiresAt: null, waitingTransfers: 0, latest: true, can: { approve: false, reject: false, revalidate: false }, ...p })

describe('admin kyc core', () => {
  it('derived state: an approval past its expiry is EXPIRED', () => {
    expect(stateOf({ status: 'APPROVED', expiresAt: '2026-10-27T00:00:00Z' }, now)).toBe('APPROVED')
    expect(stateOf({ status: 'APPROVED', expiresAt: '2026-10-25T00:00:00Z' }, now)).toBe('EXPIRED')
    expect(stateOf({ status: 'APPROVED', expiresAt: null }, now)).toBe('APPROVED')
    expect(stateOf({ status: 'REJECTED', expiresAt: null }, now)).toBe('REJECTED')
    expect(stateOf({ status: 'weird', expiresAt: null }, now)).toBe('PENDING')
    expect(filterKey('nope')).toBe('pending')
  })
  it('filters and kpis count only the latest verification of each person', () => {
    const rows = [
      row({ id: 5, userId: 1, state: 'PENDING', waitingTransfers: 2 }),
      row({ id: 4, userId: 1, state: 'REJECTED', latest: false }),
      row({ id: 3, userId: 2, state: 'APPROVED', pepHit: true }),
      row({ id: 2, userId: 3, state: 'EXPIRED' }),
      row({ id: 1, userId: 4, state: 'REJECTED', pepHit: true }),
    ]
    const ids = (f: Parameters<typeof matchesFilter>[1]) => rows.filter((r) => matchesFilter(r, f)).map((r) => r.id)
    expect(ids('pending')).toEqual([5]); expect(ids('rejected')).toEqual([4, 1]); expect(ids('pep')).toEqual([3, 1]); expect(ids('all')).toHaveLength(5)
    expect(kpisOf(rows)).toEqual({ pending: 1, approved: 1, expired: 1, rejected: 1, pep: 1, waiting: 2 })
  })
  it('who decides what', () => {
    const admin = { profile: 'admin' }, manager = { profile: 'manager' }, operator = { profile: 'operator' }
    expect(canApprove(admin, { state: 'PENDING', latest: true })).toBe(true)
    expect(canApprove(manager, { state: 'REJECTED', latest: true })).toBe(true)
    expect(canApprove(manager, { state: 'EXPIRED', latest: true })).toBe(true)
    expect(canApprove(admin, { state: 'APPROVED', latest: true })).toBe(false)
    expect(canApprove(admin, { state: 'PENDING', latest: false })).toBe(false)
    expect(canApprove(operator, { state: 'PENDING', latest: true })).toBe(false)
    expect(canReject(admin, { state: 'APPROVED', latest: true })).toBe(true)
    expect(canReject(admin, { state: 'REJECTED', latest: true })).toBe(false)
    expect(canRevalidate(admin, { state: 'APPROVED', latest: true })).toBe(true)
    expect(canRevalidate(admin, { state: 'EXPIRED', latest: true })).toBe(false)
  })
})
