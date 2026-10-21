import { describe, expect, it } from 'vitest'
import { dealCode, nextPhase, progressPct } from './domain'

describe('deal phases', () => {
  it('advance in order and end at COMPLETED', () => {
    expect(nextPhase('OFFER_ACCEPTED')).toBe('ESCROW')
    expect(nextPhase('TRANSFER')).toBe('COMPLETED')
    expect(nextPhase('COMPLETED')).toBeNull()
    expect(progressPct('SHIPPING')).toBe(50)
    expect(dealCode(2026, 3)).toBe('DL-2026-000003')
  })
})
