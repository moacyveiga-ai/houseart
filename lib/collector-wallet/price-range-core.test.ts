import { describe, expect, it } from 'vitest'
import { rangeLine, suggestedRange } from './price-range-core'

const r = (...reais: number[]) => reais.map((x) => BigInt(x) * 100n)

describe('suggested price range', () => {
  it('needs three sales', () => {
    expect(suggestedRange(r(30000, 31000))).toBeNull()
    expect(suggestedRange([])).toBeNull()
  })
  it('middle half rounded to R$ 500', () => {
    const s = suggestedRange(r(20000, 27200, 29000, 31000, 32800, 50000))
    expect(s).toEqual({ lowCents: 2_700_000n, highCents: 3_300_000n, count: 6 })
  })
  it('one value when the range collapses', () => {
    const s = suggestedRange(r(10000, 10000, 10000))!
    expect(rangeLine('Lia Santana', s)).toMatch(/^Faixa sugerida para Lia Santana: R\$\s10\.000, com base em 3 vendas/)
  })
  it('line with both ends', () => {
    expect(rangeLine('Lia', { lowCents: 2_700_000n, highCents: 3_300_000n, count: 6 })).toMatch(/R\$\s27\.000 a R\$\s33\.000, com base em 6 vendas registradas na HouseArt nos últimos 12 meses\.$/)
  })
})
