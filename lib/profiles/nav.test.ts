import { describe, expect, it } from 'vitest'
import { activeNavKey, homeOf, NAV } from './nav'

describe('NAV per profile (from the design)', () => {
  it('keeps the item count of the design', () => {
    expect(NAV.artist.map((i) => i.label)).toEqual(['Início', 'Minhas obras', 'Nova obra', 'Certificação', 'Vendas e ofertas', 'Pix para receber', 'Mensagens', 'Comunidade', 'Direito de sequência', 'Cobrança'])
    expect(NAV.gallery).toHaveLength(14)
    expect(NAV.gallery.slice(11).map((i) => i.href)).toEqual(['/gallery/team', '/gallery/artists', '/gallery/account'])
    expect(NAV.collector).toHaveLength(7)
    for (const k of ['artist', 'gallery', 'collector'] as const) expect(NAV[k].map((i) => i.href)).toEqual(expect.arrayContaining(['/messages', '/community']))
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
    expect(activeNavKey('gallery', '/gallery/team')).toBe('team')
    expect(activeNavKey('gallery', '/gallery/account')).toBe('account')
    expect(activeNavKey('gallery', '/sales/rules')).toBe('sales')
    expect(activeNavKey('collector', '/messages/12')).toBe('messages')
    expect(activeNavKey('artist', '/community')).toBe('community')
  })
})
