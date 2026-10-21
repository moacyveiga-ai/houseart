import { describe, expect, it } from 'vitest'
import { greetingFor, kpisFor, nextActionsFor, type DashboardCounts } from './core'

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
