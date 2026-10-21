import { describe, expect, it } from 'vitest'
import { estimateFromComparables, estimateLine, median, shortBRL, validRange } from './estimate-core'

describe('estimate-core', () => {
  it('median of odd and even sets', () => {
    expect(median([3n, 1n, 2n])).toBe(2n)
    expect(median([4n, 1n, 2n, 3n])).toBe(2n)
    expect(median([])).toBe(0n)
  })
  it('the design range: R$ 17 mil — R$ 21 mil sugerido — R$ 26 mil from a R$ 21 mil median', () => {
    const e = estimateFromComparables([1_900_000n, 2_100_000n, 2_400_000n])
    expect(e).toEqual({ minCents: 1_700_000n, suggestedCents: 2_100_000n, maxCents: 2_600_000n, count: 3 })
    expect(shortBRL(e!.minCents)).toBe('R$ 17 mil')
    expect(estimateLine(e!)).toBe('Estimativa de referência com base em 3 vendas comparáveis. Não é laudo.')
  })
  it('no comparables → no estimate; zero prices are ignored', () => {
    expect(estimateFromComparables([])).toBeNull()
    expect(estimateFromComparables([0n, -5n])).toBeNull()
    expect(estimateFromComparables([4_400_000n])?.count).toBe(1)
  })
  it('range validation', () => {
    expect(validRange({ minCents: 1n, suggestedCents: 2n, maxCents: 3n })).toBeNull()
    expect(validRange({ minCents: 3n, suggestedCents: 2n, maxCents: 1n })).toMatch(/Mínimo/)
    expect(validRange({ minCents: 0n, suggestedCents: 2n, maxCents: 3n })).toMatch(/positivos/)
  })
})
