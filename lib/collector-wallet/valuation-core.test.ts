import { describe, expect, it } from 'vitest'
import { changeLabel, collectionValuation, valuationNote } from './valuation-core'

describe('valorização da coleção', () => {
  it('soma só as obras com valor registrado e estimativa', () => {
    const v = collectionValuation([
      { registeredCents: 2_000_000n, estimateCents: 2_400_000n },
      { registeredCents: 1_200_000n, estimateCents: 1_360_000n },
      { registeredCents: 900_000n, estimateCents: null },
      { registeredCents: null, estimateCents: 500_000n },
    ])
    expect(v).toEqual({ registeredCents: 3_200_000n, estimatedCents: 3_760_000n, changeBps: 1750, works: 2 })
  })
  it('sem referência nenhuma não inventa número', () => {
    expect(collectionValuation([{ registeredCents: 100n, estimateCents: null }])).toBeNull()
    expect(collectionValuation([])).toBeNull()
  })
  it('rótulos', () => {
    expect(changeLabel(1750)).toBe('+17,5 %')
    expect(changeLabel(-320)).toBe('−3,2 %')
    expect(changeLabel(0)).toBe('0 %')
    const v = { registeredCents: 1n, estimatedCents: 3_724_000n, changeBps: 1, works: 2 }
    expect(valuationNote(v, 3, () => 'R$ 37.240')).toBe('Valor estimado hoje: R$ 37.240 · 2 de 3 obras com referência · não substitui um laudo')
    expect(valuationNote(v, 2, () => 'R$ 37.240')).toBe('Valor estimado hoje: R$ 37.240 · não substitui um laudo')
  })
})
