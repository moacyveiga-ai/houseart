import { describe, expect, it } from 'vitest'
import { activeNavKey, homeOf, NAV } from './nav'

describe('NAV per profile (from the design)', () => {
  it('keeps the item count of the design', () => {
    expect(NAV.artist.map((i) => i.label)).toEqual(['Início', 'Minhas obras', 'Nova obra', 'Certificação', 'Vendas e ofertas', 'Pix para receber', 'Direito de sequência', 'Cobrança'])
    expect(NAV.gallery).toHaveLength(9)
    expect(NAV.collector).toHaveLength(5)
    expect(NAV.appraiser).toHaveLength(1)
    expect(NAV.admin).toHaveLength(3)
    expect(NAV.advisor).toBe(NAV.gallery)
  })
  it('homeOf and activeNavKey', () => {
    expect(homeOf('collector')).toBe('/wallet')
    expect(activeNavKey('artist', '/artworks/new')).toBe('new')
    expect(activeNavKey('artist', '/artworks/12')).toBe('artworks')
    expect(activeNavKey('artist', '/')).toBe('home')
    expect(activeNavKey('artist', '/zzz')).toBeNull()
    expect(activeNavKey('collector', '/wallet/cards')).toBe('cards')
    expect(activeNavKey('artist', '/sales/payout')).toBe('payout')
    expect(activeNavKey('artist', '/sales')).toBe('sales')
  })
})
