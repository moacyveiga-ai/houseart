import { describe, expect, it } from 'vitest'
import { evaluateOffer, mandateProblems } from './mandate-core'
import { assertTransition, buyerFacingStatus, canTransition, statusAfterOtp } from './state'
import { differencePct, formatDifference, offerCode } from './domain'

const m = { listPriceCents: 4_400_000n, reservePriceCents: 3_800_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false }

describe('mandate engine', () => {
  it('auto-accepts at or above 92 %, leaves the rest to the seller, counters below the floor without ever emitting it', () => {
    expect(evaluateOffer(m, 4_100_000n)).toEqual({ verdict: 'AUTO_ACCEPT', reachesReserve: true })
    expect(evaluateOffer(m, 3_900_000n)).toEqual({ verdict: 'ABOVE_RESERVE', reachesReserve: true })
    const below = evaluateOffer(m, 3_500_000n)
    expect(below.verdict).toBe('BELOW_RESERVE')
    expect(below.counterCents).toBe(4_048_000n)
    expect(below.counterCents).not.toBe(m.reservePriceCents)
    expect(evaluateOffer({ ...m, autoNegotiatorOn: false }, 4_300_000n).verdict).toBe('ABOVE_RESERVE')
    expect(evaluateOffer(m, 3_500_000n, 3).counterCents).toBeUndefined()
  })
  it('validates the mandate', () => {
    expect(mandateProblems({ listPriceCents: 100n, reservePriceCents: 120n, autoAcceptMinBps: 9200 })).toContain('O piso não pode passar do preço pedido.')
    expect(mandateProblems({ listPriceCents: 4_400_000n, reservePriceCents: 4_300_000n, autoAcceptMinBps: 9200 })).toContain('O mínimo do negociador não pode ficar abaixo do piso.')
    expect(mandateProblems(m)).toEqual([])
  })
})

describe('offer state', () => {
  it('transitions', () => {
    expect(canTransition('RECEIVED', 'ACCEPTED')).toBe(true)
    expect(canTransition('REFUSED', 'ACCEPTED')).toBe(false)
    expect(() => assertTransition('ACCEPTED', 'RECEIVED')).toThrow('Transição inválida')
    expect(statusAfterOtp(false)).toBe('BELOW_RESERVE')
    expect(buyerFacingStatus('BELOW_RESERVE')).toBe('RECEIVED')
  })
  it('labels', () => {
    expect(offerCode(2026, 7)).toBe('OFR-2026-000007')
    expect(formatDifference(differencePct(4_100_000n, 4_400_000n))).toBe('−7%')
    expect(formatDifference(differencePct(4_400_000n, 4_400_000n))).toBe('no preço pedido')
  })
})
