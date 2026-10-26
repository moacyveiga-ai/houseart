import { describe, expect, it } from 'vitest'
import { centsToInput, changedKeys, deactivationBlock, DEFAULT_PLAN_CODES, parseCents, parsePlanInput, parseServiceInput, SELF_CHARGED_CODES } from './core'

describe('admin catalog core', () => {
  it('a number is cents; a string is what a person types, in reais', () => {
    expect(parseCents(4900)).toBe(4900)
    expect(parseCents('49')).toBe(4900); expect(parseCents('4900')).toBe(490000); expect(parseCents('R$ 49')).toBe(4900)
    expect(parseCents('49,90')).toBe(4990); expect(parseCents('49.9')).toBe(4990); expect(parseCents(' 49,9 ')).toBe(4990)
    expect(parseCents('R$ 1.234,50')).toBe(123450); expect(parseCents('1.234')).toBe(123400); expect(parseCents('1,234.50')).toBe(123450); expect(parseCents('1234,50')).toBe(123450)
    expect(parseCents('49,')).toBeNull(); expect(parseCents('1.23.4')).toBeNull()
    expect(parseCents(-1)).toBeNull(); expect(parseCents(12.5)).toBeNull(); expect(parseCents('abc')).toBeNull(); expect(parseCents('')).toBeNull()
    expect(parseCents(100_000_001)).toBeNull(); expect(parseCents('1.000.001')).toBeNull()
    expect(centsToInput(4990)).toBe('49,90'); expect(centsToInput('0')).toBe('0,00')
  })
  it('parses a plan: limits only by the keys the plan has, empty = unlimited', () => {
    const keys = ['ARTWORKS', 'TAGS_INCLUDED', 'APPRAISALS_INCLUDED']
    const r = parsePlanInput({ name: ' Ateliê ', description: 'x', priceCents: '49,00', active: true, limits: { ARTWORKS: '60', TAGS_INCLUDED: '', APPRAISALS_INCLUDED: 0 } }, keys)
    expect(r).toEqual({ ok: true, value: { name: 'Ateliê', description: 'x', priceCents: 4900, active: true, limits: { ARTWORKS: 60, TAGS_INCLUDED: null, APPRAISALS_INCLUDED: 0 } } })
    expect(parsePlanInput({ name: 'a', priceCents: 1, active: true, limits: { SEATS: 1 } }, keys).ok).toBe(false) // a line the artist's price card never had
    expect(parsePlanInput({ name: '', priceCents: 1, active: true }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a', priceCents: 1, active: 'yes' }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a', priceCents: 1, active: true, limits: { NOPE: 1 } }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a', priceCents: 1, active: true, limits: { ARTWORKS: -1 } }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a'.repeat(81), priceCents: 1, active: true }).ok).toBe(false)
  })
  it('parses a service: a zero price only under quote', () => {
    expect(parseServiceInput({ name: 'Etiqueta', description: '', priceCents: 1500, unit: 'UNIT', active: true })).toEqual({ ok: true, value: { name: 'Etiqueta', description: '', priceCents: 1500, unit: 'UNIT', active: true } })
    expect(parseServiceInput({ name: 'Frete', priceCents: 0, unit: 'QUOTE', active: true }).ok).toBe(true)
    expect(parseServiceInput({ name: 'Frete', priceCents: 0, unit: 'UNIT', active: true }).ok).toBe(false)
    expect(parseServiceInput({ name: 'Frete', priceCents: 10, unit: 'HOUR', active: true }).ok).toBe(false)
    // what the platform charges by itself is never "under quote" nor free
    expect(SELF_CHARGED_CODES).toEqual(['TAG_KIT', 'OFFPLATFORM_TRANSFER', 'APPRAISAL_SIGNED'])
    expect(parseServiceInput({ name: 'Etiqueta', priceCents: 0, unit: 'QUOTE', active: true }, 'TAG_KIT').ok).toBe(false)
    expect(parseServiceInput({ name: 'Etiqueta', priceCents: 1500, unit: 'UNIT', active: true }, 'TAG_KIT').ok).toBe(true)
    expect(parseServiceInput({ name: 'Frete', priceCents: 0, unit: 'QUOTE', active: true }, 'SHIPPING').ok).toBe(true)
  })
  it('the default plan of each audience is never switched off', () => {
    expect(DEFAULT_PLAN_CODES).toEqual(['ARTIST_FREE', 'GALLERY', 'ADVISOR'])
    expect(deactivationBlock('ARTIST_FREE')).toMatch(/padrão/)
    expect(deactivationBlock('ARTIST_STUDIO')).toBeNull()
  })
  it('lists the keys that changed', () => {
    expect(changedKeys({ a: 1, b: { x: 1 }, c: 'z' }, { a: 1, b: { x: 2 }, c: 'z' })).toEqual(['b'])
  })
})
