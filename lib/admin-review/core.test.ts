import { describe, expect, it } from 'vitest'
import { averageOpenHours, needsReason, openedAgo, REVIEW_EFFECTS, REVIEW_KINDS, shareLabel } from './core'

describe('admin review core', () => {
  const now = new Date('2026-10-26T12:00:00Z')
  it('openedAgo speaks like the prototype', () => {
    expect(openedAgo(now, new Date('2026-10-26T11:40:00Z'))).toBe('há 20 min')
    expect(openedAgo(now, new Date('2026-10-26T10:00:00Z'))).toBe('há 2 h')
    expect(openedAgo(now, new Date('2026-10-25T11:00:00Z'))).toBe('há 1 dia')
    expect(openedAgo(now, new Date('2026-10-22T12:00:00Z'))).toBe('há 4 dias')
    expect(openedAgo(now, new Date('2026-10-26T12:00:30Z'))).toBe('agora')
  })
  it('every kind has an effect for both decisions', () => {
    for (const k of REVIEW_KINDS) { expect(REVIEW_EFFECTS[k].APPROVED).toBeTruthy(); expect(REVIEW_EFFECTS[k].REJECTED).toBeTruthy() }
  })
  it('revoking a certificate always asks for a reason', () => {
    expect(needsReason('CONTESTATION', 'APPROVED')).toBe(true)
    expect(needsReason('CONTESTATION', 'REJECTED')).toBe(false)
    expect(needsReason('MARKER_REMOVED', 'APPROVED')).toBe(true)
    expect(needsReason('DUPLICATE', 'REJECTED')).toBe(true)
  })
  it('average and share', () => {
    expect(averageOpenHours(now, [])).toBeNull()
    expect(averageOpenHours(now, [new Date('2026-10-26T06:00:00Z'), new Date('2026-10-26T12:00:00Z')])).toBe(3)
    expect(shareLabel(3, 18402)).toBe('0,02% das obras')
    expect(shareLabel(0, 0)).toBe('0% das obras')
  })
  it('filters, kinds and hrefs of the chips; the decided line', async () => {
    const { reviewFilterKey, reviewKindKey, reviewHref, decidedLine } = await import('./core')
    expect(reviewFilterKey('decided')).toBe('decided'); expect(reviewFilterKey('x')).toBe('open'); expect(reviewFilterKey(undefined)).toBe('open')
    expect(reviewKindKey('CONTESTATION')).toBe('CONTESTATION'); expect(reviewKindKey('nope')).toBeNull()
    expect(reviewHref('open', null)).toBe('/admin/review')
    expect(reviewHref('mine', 'DUPLICATE')).toBe('/admin/review?f=mine&kind=DUPLICATE')
    expect(decidedLine('APPROVED', 'Ana', 'há 2 h')).toBe('Aprovado por Ana · há 2 h')
    expect(decidedLine('REJECTED', null, 'há 1 dia')).toBe('Rejeitado · há 1 dia')
  })
})
