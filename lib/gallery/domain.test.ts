import { describe, expect, it } from 'vitest'
import { belowRule, panelKpis, rulesProblems, salesComparison, DEFAULT_RULES } from './domain'

describe('gallery domain', () => {
  it('rule validation', () => {
    expect(rulesProblems(DEFAULT_RULES)).toEqual([])
    expect(rulesProblems({ ...DEFAULT_RULES, refuseBelowBps: 6500, responseHours: 10, autoAcceptMinBps: 100 })).toHaveLength(3)
  })
  it('below rule by bps of the list price', () => {
    expect(belowRule(6_900_000n, 10_000_000n, 7000)).toBe(true)
    expect(belowRule(7_000_000n, 10_000_000n, 7000)).toBe(false)
    expect(belowRule(1n, 0n, 7000)).toBe(false)
  })
  it('panel kpis', () => {
    const k = panelKpis({ monthSalesCents: 7_100_000n, monthSalesCount: 2, openOffers: 0, biggestOpenOfferCents: null, escrowCents: 0n, views7d: 1234 }, 'outubro')
    expect(k.map((x) => x.value)).toEqual(['R$ 71.000', '0', 'R$ 0', '1.234'])
    expect(k[1].detail).toBe('nenhuma agora')
  })
})

describe('salesComparison', () => {
  it('says the change against the same stretch of the previous month', () => {
    expect(salesComparison(118n, 100n, 'setembro')).toBe('+18% vs. setembro')
    expect(salesComparison(95n, 100n, 'setembro')).toBe('−5% vs. setembro')
    expect(salesComparison(100n, 100n, 'setembro')).toBe('0% vs. setembro')
    expect(salesComparison(100n, 0n, 'setembro')).toBeNull()
    expect(salesComparison(100n, undefined, undefined)).toBeNull()
  })
})
