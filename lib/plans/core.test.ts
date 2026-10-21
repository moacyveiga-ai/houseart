import { describe, expect, it } from 'vitest'
import { artworkRegistrationGate, monthKey, monthRange, priceLabel, usageBars } from './core'
import { appraisalCode, isAppraisalCode } from '@/lib/appraisal/domain'

describe('plans core', () => {
  it('usage bars follow the audience and the design text', () => {
    const bars = usageBars('ARTIST', { ARTWORKS: 60, TAGS_INCLUDED: 10, APPRAISALS_INCLUDED: 1 }, { ARTWORKS: 38, TAGS_INCLUDED: 7, APPRAISALS_INCLUDED: 0 })
    expect(bars.map((b) => [b.label, b.text, b.pct])).toEqual([['Obras cadastradas', '38 de 60', 63], ['Etiquetas disponíveis', '7 de 10', 70], ['Laudos incluídos', '0 de 1', 0]])
    const g = usageBars('GALLERY', { CERTIFICATIONS_MONTH: 40, VIEWING_ROOMS: 10, SEATS: 5 }, { CERTIFICATIONS_MONTH: 18, VIEWING_ROOMS: 3, SEATS: 4 })
    expect(g.map((b) => b.text)).toEqual(['18 de 40', '3 de 10', '4 de 5'])
    expect(usageBars('ARTIST', {}, { ARTWORKS: 3 })[0]).toMatchObject({ text: '3', pct: 0 })
    expect(usageBars('ARTIST', { ARTWORKS: 0 }, { ARTWORKS: 1 })[0].pct).toBe(100)
  })
  it('registration gate', () => {
    expect(artworkRegistrationGate(9, 10)).toEqual({ ok: true })
    expect(artworkRegistrationGate(10, 10)).toMatchObject({ ok: false })
    expect(artworkRegistrationGate(500, null)).toEqual({ ok: true })
  })
  it('month in the house timezone', () => {
    expect(monthKey(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10')
    expect(monthKey(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11')
    const r = monthRange(new Date('2026-10-21T12:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(priceLabel(0n)).toBe('Grátis'); expect(priceLabel(89900n)).toBe('R$ 899')
  })
  it('appraisal code', () => {
    const c = appraisalCode(2026, (n) => Array.from({ length: n }, (_, i) => i * 7))
    expect(c).toMatch(/^HA-L-2026-[A-Z2-9]{4}$/)
    expect(isAppraisalCode(c)).toBe(true)
    expect(isAppraisalCode('HA-2026-ABCD-EFGH')).toBe(false)
  })
})
