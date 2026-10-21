import { describe, expect, it } from 'vitest'
import { cheapest, formatCep, installmentCents, insuranceCents, normalizeCep, quoteShipping, sizeClassOf, ufFromCep, zoneOf } from './quote-core'

const PAINTING = { heightMm: 1000, widthMm: 800, depthMm: 40 }

describe('shipping quote (pure, deterministic)', () => {
  it('normalizes and formats the CEP', () => {
    expect(normalizeCep('40140-110')).toBe('40140110')
    expect(normalizeCep(' 40.140 110 ')).toBe('40140110')
    expect(normalizeCep('4014011')).toBeNull()
    expect(formatCep('40140110')).toBe('40140-110')
  })

  it('finds the UF by the CEP ranges', () => {
    expect(ufFromCep('40140-110')).toBe('BA')
    expect(ufFromCep('01311-000')).toBe('SP')
    expect(ufFromCep('69301-000')).toBe('RR')
    expect(ufFromCep('69400-000')).toBe('AM')
    expect(ufFromCep('73000-000')).toBe('DF')
    expect(ufFromCep('78900-000')).toBe('RO')
    expect(ufFromCep('99999-999')).toBe('RS')
    expect(ufFromCep('00100-000')).toBeNull()
    expect(ufFromCep('abc')).toBeNull()
  })

  it('zones by region distance from the seller', () => {
    expect(zoneOf('BA', 'BA')).toBe(1)
    expect(zoneOf('BA', 'PE')).toBe(2)
    expect(zoneOf('BA', 'SP')).toBe(3)
    expect(zoneOf('BA', 'RS')).toBe(4)
    expect(zoneOf(null, 'ba')).toBe(1) // unknown origin = the house in Bahia
    expect(zoneOf('SP', 'AM')).toBe(4)
  })

  it('classifies the size by the longest side', () => {
    expect(sizeClassOf({ heightMm: 500, widthMm: 500, depthMm: null })).toBe('SMALL')
    expect(sizeClassOf(PAINTING)).toBe('MEDIUM')
    expect(sizeClassOf({ heightMm: 1400, widthMm: 1050, depthMm: null })).toBe('LARGE')
    expect(sizeClassOf({ heightMm: 2600, widthMm: 900, depthMm: null })).toBe('XL')
    expect(sizeClassOf({ heightMm: null, widthMm: null, depthMm: null })).toBe('SMALL')
  })

  it('reproduces the design example: 100 × 80 cm to Salvador', () => {
    const q = quoteShipping({ fromUf: 'BA', toUf: 'BA', size: PAINTING })
    expect(q).toEqual([
      { carrier: 'ALVES_TEGAM', name: 'Alves Tegam', days: 5, priceCents: 89_000 },
      { carrier: 'FINK', name: 'Fink', days: 4, priceCents: 102_000 },
      { carrier: 'CONVELIO', name: 'Convelio', days: 7, priceCents: 76_000 },
    ])
    expect(cheapest(q!).carrier).toBe('CONVELIO')
  })

  it('grows with distance and size, in whole reais, and is the same for the same input', () => {
    const local = quoteShipping({ fromUf: 'BA', toUf: 'BA', size: PAINTING })!
    const far = quoteShipping({ fromUf: 'BA', toUf: 'RS', size: PAINTING })!
    const big = quoteShipping({ fromUf: 'BA', toUf: 'BA', size: { heightMm: 2500, widthMm: 1800, depthMm: null } })!
    far.forEach((f, i) => { expect(f.priceCents).toBeGreaterThan(local[i].priceCents); expect(f.days).toBeGreaterThan(local[i].days); expect(f.priceCents % 100).toBe(0) })
    big.forEach((b, i) => expect(b.priceCents).toBeGreaterThan(local[i].priceCents))
    expect(quoteShipping({ fromUf: 'BA', toUf: 'RS', size: PAINTING })).toEqual(far)
  })

  it('has no quote without a known destination', () => {
    expect(quoteShipping({ fromUf: 'BA', toUf: null, size: PAINTING })).toBeNull()
    expect(quoteShipping({ fromUf: 'BA', toUf: 'XX', size: PAINTING })).toBeNull()
  })

  it('insurance and instalments', () => {
    expect(insuranceCents(3_800_000)).toBe(22_000) // R$ 220 on R$ 38.000
    expect(insuranceCents(50_000)).toBe(6_000) // floor R$ 60
    expect(installmentCents(3_800_000)).toBe(380_000)
    expect(installmentCents(999_999)).toBe(99_900)
  })
})
