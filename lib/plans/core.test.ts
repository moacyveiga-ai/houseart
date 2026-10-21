import { describe, expect, it } from 'vitest'
import { artworkRegistrationGate, comparePublicPlans, monthKey, monthRange, planCtaLabel, planFeatureLines, priceLabel, usageBars } from './core'
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

  it('public price cards: lines from the limits, prototype order and CTA', () => {
    expect(planFeatureLines({ ARTWORKS: 10, TAGS_INCLUDED: 0, APPRAISALS_INCLUDED: 0 })).toEqual(['Até 10 obras cadastradas'])
    expect(planFeatureLines({ ARTWORKS: 60, TAGS_INCLUDED: 10, APPRAISALS_INCLUDED: 1 })).toEqual(['Até 60 obras cadastradas', '10 etiquetas incluídas por ano', '1 laudo incluído'])
    expect(planFeatureLines({ ARTWORKS: null, CERTIFICATIONS_MONTH: 15, VIEWING_ROOMS: 3, SEATS: 1 })).toEqual(['Obras ilimitadas', '15 certificações por mês', '3 viewing rooms', '1 usuário'])
    expect(planFeatureLines({})).toEqual([])
    const order = [{ audience: 'ADVISOR', priceCents: 14900n }, { audience: 'GALLERY', priceCents: 89900n }, { audience: 'ARTIST', priceCents: 4900n }, { audience: 'GALLERY', priceCents: 34900n }, { audience: 'ARTIST', priceCents: 0n }] as const
    expect([...order].sort(comparePublicPlans).map((p) => p.priceCents)).toEqual([0n, 4900n, 34900n, 89900n, 14900n])
    expect(planCtaLabel('Artista', 0n)).toBe('Começar grátis')
    expect(planCtaLabel('Ateliê', 4900n)).toBe('Assinar Ateliê')
  })
})
