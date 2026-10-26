import { describe, expect, it } from 'vitest'
import { centsToInput, changedKeys, deactivationBlock, DEFAULT_PLAN_CODES, parseCents, parsePlanInput, parseServiceInput } from './core'

describe('admin catalog core', () => {
  it('reads reais and cents', () => {
    expect(parseCents(4900)).toBe(4900)
    expect(parseCents('4900')).toBe(4900)
    expect(parseCents('49,90')).toBe(4990)
    expect(parseCents('49.9')).toBe(4990)
    expect(parseCents('R$ 1.234,50')).toBe(123450)
    expect(parseCents(-1)).toBeNull(); expect(parseCents(12.5)).toBeNull(); expect(parseCents('abc')).toBeNull(); expect(parseCents('')).toBeNull()
    expect(parseCents(100_000_001)).toBeNull()
    expect(centsToInput(4990)).toBe('49,90'); expect(centsToInput('0')).toBe('0,00')
  })
  it('parses a plan: limits by known key, empty = unlimited', () => {
    const r = parsePlanInput({ name: ' Ateliê ', description: 'x', priceCents: '49,00', active: true, limits: { ARTWORKS: '60', TAGS_INCLUDED: '', APPRAISALS_INCLUDED: 0 } })
    expect(r).toEqual({ ok: true, value: { name: 'Ateliê', description: 'x', priceCents: 4900, active: true, limits: { ARTWORKS: 60, TAGS_INCLUDED: null, APPRAISALS_INCLUDED: 0 } } })
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
