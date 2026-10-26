import { describe, expect, it } from 'vitest'
import { greetingFor, kpisFor, nextActionsFor, type DashboardCounts, salesChart, shortBRL } from './core'

const c: DashboardCounts = { authenticated: 3, listed: 1, soldThisYear: 2, soldThisYearCents: 1000000n, inventory: 10, consigned: 2, openOffers: 1, royaltyCents: 0n, awaitingSignature: 1, pendingMedia: 2, markersToLink: 0 }

describe('dashboard core', () => {
  it('artist and gallery KPIs follow the design labels', () => {
    expect(kpisFor('artist', c, 2026).map((k) => k.label)).toEqual(['Obras certificadas', 'À venda', 'Vendidas em 2026', 'Direito de sequência'])
    expect(kpisFor('gallery', c, 2026)[0]).toMatchObject({ value: '10', note: '2 em consignação' })
  })
  it('next actions only for what exists', () => {
    expect(nextActionsFor(c).map((a) => a.title)).toEqual(['Assinar certificado', 'Responder ofertas', 'Completar as fotos'])
    expect(nextActionsFor({ ...c, awaitingSignature: 0, openOffers: 0, pendingMedia: 0 })).toEqual([])
  })
  it('greeting by the house timezone', () => {
    expect(greetingFor('Joana Teixeira', new Date('2026-10-19T12:00:00Z'))).toBe('Bom dia, Joana')
    expect(greetingFor('Joana', new Date('2026-10-19T23:30:00Z'))).toBe('Boa noite, Joana')
  })
})

describe('salesChart', () => {
  it('buckets completed deals by month up to the current one, scales by the biggest month, marks the current', () => {
    const c = salesChart([
      { day: '2026-01-15', amountCents: 1_200_000n }, { day: '2026-03-02', amountCents: 2_400_000n }, { day: '2026-03-20', amountCents: 2_400_000n },
      { day: '2025-12-31', amountCents: 9_900_000n }, { day: '2026-11-01', amountCents: 9_900_000n },
    ], 2026, 10)
    expect(c.bars).toHaveLength(10)
    expect(c.bars.map((b) => b.month)).toEqual(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'])
    expect(c.bars[0]).toMatchObject({ count: 1, label: 'R$ 12 mil', pct: 25, current: false })
    expect(c.bars[2]).toMatchObject({ count: 2, label: 'R$ 48 mil', pct: 100 })
    expect(c.bars[1]).toMatchObject({ count: 0, label: '', pct: 0 })
    expect(c.bars[9].current).toBe(true)
    expect(c.total).toBe('R$ 60 mil em 3 obras')
    expect(c.empty).toBe(false)
  })
  it('a tiny month still shows a sliver; no sales reads as empty', () => {
    const c = salesChart([{ day: '2026-02-01', amountCents: 100_000n }, { day: '2026-02-02', amountCents: 100_000_000n }], 2026, 2)
    expect(c.bars[1]).toMatchObject({ pct: 100, label: 'R$ 1 mi' })
    expect(salesChart([], 2026, 1)).toMatchObject({ total: 'Nenhuma venda concluída ainda', empty: true })
    expect(salesChart([], 2026, 1).bars).toHaveLength(1)
  })
  it('shortBRL', () => {
    expect(shortBRL(98_000n)).toBe('R$ 980')
    expect(shortBRL(1_200_000n)).toBe('R$ 12 mil')
    expect(shortBRL(26_800_000n)).toBe('R$ 268 mil')
    expect(shortBRL(123_000_000n)).toBe('R$ 1,2 mi')
  })
})
