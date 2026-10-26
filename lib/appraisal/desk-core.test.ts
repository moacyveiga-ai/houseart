import { describe, expect, it } from 'vitest'
import { canIssue, canTake, daysLeft, dueLabel, kpisOf, matchesFilter, parseDueDay, stateOf } from './desk-core'

const now = new Date('2026-10-26T15:00:00Z')
const row = (p: Partial<{ id: number; status: string; dueOn: string; assignedAppraiserId: number | null }> = {}) => ({ id: 1, status: 'QUEUED', dueOn: '2026-10-30T12:00:00Z', assignedAppraiserId: null, ...p })

describe('appraisal desk core', () => {
  it('derives the state: overdue from the deadline, never from a column', () => {
    expect(stateOf(row(), now)).toBe('QUEUED')
    expect(stateOf(row({ status: 'IN_PROGRESS' }), now)).toBe('IN_PROGRESS')
    expect(stateOf(row({ dueOn: '2026-10-25T12:00:00Z' }), now)).toBe('OVERDUE')
    expect(stateOf(row({ status: 'ISSUED', dueOn: '2026-10-25T12:00:00Z' }), now)).toBe('ISSUED')
    expect(stateOf(row({ status: 'CANCELLED' }), now)).toBe('CANCELLED')
  })
  it('counts days by the house calendar day', () => {
    expect(daysLeft('2026-10-30T12:00:00Z', now)).toBe(4)
    expect(daysLeft('2026-10-27T01:00:00Z', now)).toBe(0) // 22h of the 26th in Bahia
    expect(daysLeft('2026-10-24T12:00:00Z', now)).toBe(-2)
    expect(dueLabel('2026-10-24T12:00:00Z', now, 'QUEUED')).toBe('2 dias de atraso')
    expect(dueLabel('2026-10-27T15:00:00Z', now, 'QUEUED')).toBe('vence amanhã')
    expect(dueLabel('2026-10-27T15:00:00Z', now, 'ISSUED')).toBe('')
  })
  it('decides who issues and who takes', () => {
    const staff = { userId: 9, profile: 'manager' }
    const ava = { userId: 5, profile: 'appraiser' }
    const other = { userId: 6, profile: 'appraiser' }
    expect(canIssue(ava, row())).toBe(true)
    expect(canIssue(ava, row({ assignedAppraiserId: 5 }))).toBe(true)
    expect(canIssue(other, row({ assignedAppraiserId: 5 }))).toBe(false)
    expect(canIssue(staff, row({ assignedAppraiserId: 5 }))).toBe(true)
    expect(canIssue(ava, row({ status: 'ISSUED' }))).toBe(false)
    expect(canTake(ava, row())).toBe(true)
    expect(canTake(ava, row({ assignedAppraiserId: 6 }))).toBe(false)
    expect(canTake(staff, row())).toBe(false)
  })
  it('filters and kpis', () => {
    const rows = [row({ id: 1 }), row({ id: 2, assignedAppraiserId: 5, status: 'IN_PROGRESS' }), row({ id: 3, dueOn: '2026-10-20T12:00:00Z', assignedAppraiserId: 5 }), row({ id: 4, status: 'ISSUED' }), row({ id: 5, dueOn: '2026-10-27T12:00:00Z' })]
    expect(rows.filter((r) => matchesFilter(r, 'mine', 5, now)).map((r) => r.id)).toEqual([2, 3])
    expect(rows.filter((r) => matchesFilter(r, 'unassigned', 5, now)).map((r) => r.id)).toEqual([1, 5])
    expect(rows.filter((r) => matchesFilter(r, 'overdue', 5, now)).map((r) => r.id)).toEqual([3])
    expect(kpisOf(rows, now)).toEqual({ open: 4, unassigned: 2, overdue: 1, dueSoon: 1, issued: 1 })
  })
  it('accepts only a real day, today or later, within the window', () => {
    expect(parseDueDay('2026-10-26', now)).toBe('2026-10-26')
    expect(parseDueDay('2026-10-25', now)).toBeNull()
    expect(parseDueDay('2026-02-30', now)).toBeNull()
    expect(parseDueDay('2027-10-26', now)).toBeNull()
    expect(parseDueDay(12, now)).toBeNull()
  })
})
