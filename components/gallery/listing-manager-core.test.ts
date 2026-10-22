import { describe, expect, it } from 'vitest'
import { acceptsOffersSub, listingStats, pausedSub, priceCents, priceChanged, priceMask, priceReais, priceSavedMessage, publicArtworkPath, shareMessage } from './listing-manager-core'

describe('listing-manager-core', () => {
  it('masks the price like the prototype (digits only, pt-BR thousands)', () => {
    expect(priceMask('38000')).toBe('38.000')
    expect(priceMask('R$ 38.000,00')).toBe('3.800.000')
    expect(priceMask('abc')).toBe('')
    expect(priceMask(0)).toBe('')
    expect(priceMask(185000)).toBe('185.000')
    expect(priceReais('1.250')).toBe(1250)
  })
  it('converts the mask to cents and knows when the price changed', () => {
    expect(priceCents('38.000')).toBe(3800000n)
    expect(priceChanged('38.000', 3800000n)).toBe(false)
    expect(priceChanged('38.000', '3800000')).toBe(false)
    expect(priceChanged('37.500', 3800000n)).toBe(true)
    expect(priceChanged('', 3800000n)).toBe(false)
    expect(priceChanged('0', 3800000n)).toBe(false)
  })
  it('tells a reduction from an update', () => {
    expect(priceSavedMessage(3700000n, 3800000n)).toBe('Preço reduzido')
    expect(priceSavedMessage(3900000n, 3800000n)).toBe('Preço atualizado')
  })
  it('writes the toggle texts from the rules', () => {
    expect(acceptsOffersSub(true, { refuseBelowBps: 7000, responseHours: 48 })).toBe('Regras: recusa abaixo de 70% · prazo 48 h')
    expect(acceptsOffersSub(true, null)).toBe('Ofertas pelas regras da galeria')
    expect(acceptsOffersSub(false, { refuseBelowBps: 7000, responseHours: 48 })).toBe('Só compra direta')
    expect(pausedSub(true)).toMatch(/Fora do marketplace/)
    expect(pausedSub(false)).toMatch(/Some do marketplace/)
  })
  it('builds the share message with the public link', () => {
    expect(publicArtworkPath('HA-2026-7K3F-9Q2M')).toBe('/e/artwork/HA-2026-7K3F-9Q2M')
    expect(shareMessage({ title: 'Construção nº 7', artistName: 'Joana Teixeira' }, 'https://x/e/artwork/HA-1')).toBe('Separei esta obra para você: Construção nº 7, de Joana Teixeira. Qualquer dúvida, é só responder. https://x/e/artwork/HA-1')
  })
  it('lists the four stats with the missing ones as "—"', () => {
    expect(listingStats({ views7d: 1234, openOffers: 1 }).map((s) => `${s.value} ${s.label}`)).toEqual(['1.234 views · 7 dias', '— salvos', '— curtidas', '1 oferta'])
    expect(listingStats({ views7d: 0, openOffers: 2 })[3]).toEqual({ value: '2', label: 'ofertas' })
  })
})
