import { describe, expect, it } from 'vitest'
import { rangeLine, stepOf, suggestedRange } from './price-range-core'

const r = (...reais: number[]) => reais.map((x) => BigInt(x) * 100n)

describe('suggested price range', () => {
  it('needs six sales', () => {
    expect(suggestedRange(r(30000, 31000, 32000, 33000, 34000))).toBeNull()
    expect(suggestedRange([])).toBeNull()
  })
  it('step grows with the price, never under R$ 1.000', () => {
    expect(stepOf(1_000_000n)).toBe(100_000n) // R$ 10.000 → R$ 1.000
    expect(stepOf(10_000_000n)).toBe(500_000n) // R$ 100.000 → R$ 5.000
  })
  it('interpolated quartiles, ends rounded outwards — no end is one sale', () => {
    const sales = r(20000, 27200, 29000, 31000, 32800, 50000)
    const s = suggestedRange(sales)!
    expect(s.count).toBe(6)
    expect(s.lowCents % 100_000n).toBe(0n)
    expect(s.highCents % 100_000n).toBe(0n)
    expect(s.lowCents).toBeLessThan(s.highCents)
    for (const v of sales) { expect(v).not.toBe(s.lowCents); expect(v).not.toBe(s.highCents) }
  })
  it('equal sales still give a band', () => {
    const s = suggestedRange(r(10000, 10000, 10000, 10000, 10000, 10000))!
    expect(s.highCents - s.lowCents).toBe(100_000n)
  })
  it('line', () => {
    expect(rangeLine('Lia', { lowCents: 2_700_000n, highCents: 3_300_000n, count: 6 })).toMatch(/^Faixa sugerida para Lia: R\$\s27\.000 a R\$\s33\.000, com base em 6 vendas registradas na HouseArt nos últimos 12 meses\.$/)
  })
})
