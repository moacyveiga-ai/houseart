import { describe, expect, it } from 'vitest'
import { artistStatus, bpsPercent, galleriesHref, galleriesSummary, galleryInitial, initialsOf, osmEmbedUrl, passesWorkFilter, photoSpan, publicationPrice, royaltyText, sellerLine, tagsOf, ufsOf, workFilterOf, workPriceLabel } from './profile-core'

describe('profile-core', () => {
  it('formats bps as pt-BR percent', () => {
    expect(bpsPercent(400)).toBe('4%')
    expect(bpsPercent(550)).toBe('5,5%')
  })
  it('status and royalty by alive/deceased', () => {
    expect(artistStatus(true, null)).toBe('Em atividade')
    expect(artistStatus(false, '1931–2009')).toBe('In memoriam · 1931–2009')
    expect(royaltyText(400, true)).toBe('Recebe 4% em toda revenda pela HouseArt, pago automaticamente.')
    expect(royaltyText(500, false)).toMatch(/^O espólio recebe 5%/)
  })
  it('initials and gallery mark', () => {
    expect(initialsOf('Joana Teixeira')).toBe('JT')
    expect(initialsOf('Tomás Antônio Rezende Filho')).toBe('TA')
    expect(galleryInitial('Galeria Ladeira')).toBe('L')
    expect(galleryInitial('Casa Tamarindo')).toBe('T')
    expect(galleryInitial('Luz Norte')).toBe('L')
  })
  it('work filters and labels', () => {
    expect(workFilterOf('venda')).toBe('venda')
    expect(workFilterOf('x')).toBe('todas')
    expect(passesWorkFilter('SOLD', 'vendidas')).toBe(true)
    expect(passesWorkFilter('LISTED', 'vendidas')).toBe(false)
    expect(passesWorkFilter('IN_DEAL', 'todas')).toBe(true)
    expect(workPriceLabel({ status: 'SOLD', priceCents: 100n })).toBe('Vendida')
    expect(workPriceLabel({ status: 'LISTED', priceCents: null })).toBe('Sob consulta')
    expect(workPriceLabel({ status: 'LISTED', priceCents: 3_800_000n })).toMatch(/38\.000/)
    expect(workPriceLabel({ status: 'IN_DEAL', priceCents: 1n })).toBe('Em negociação')
    expect(sellerLine(null)).toEqual({ name: 'Colecionador particular', kind: 'Particular', icon: 'person' })
    expect(sellerLine('Galeria Ladeira').kind).toBe('Galeria')
    expect(publicationPrice(null)).toBe('Grátis')
    expect(publicationPrice(3900n)).toMatch(/39/)
  })
  it('map embed and mosaic', () => {
    const u = osmEmbedUrl(-12.9668, -38.5048)
    expect(u.startsWith('https://www.openstreetmap.org/export/embed.html?bbox=')).toBe(true)
    expect(u).toContain('marker=-12.96680%2C-38.50480')
    expect(photoSpan(0)).toEqual({ c: 2, r: 2 })
    expect(photoSpan(5)).toEqual({ c: 2, r: 1 })
    expect(photoSpan(6)).toEqual({ c: 2, r: 2 })
  })
  it('galleries list helpers', () => {
    expect(galleriesSummary(9, 446)).toBe('9 galerias · 446 obras')
    expect(galleriesSummary(1, 1)).toBe('1 galeria · 1 obra')
    expect(tagsOf([{ tags: ['A', 'B'] }, { tags: ['B', 'C'] }])).toEqual(['A', 'B', 'C'])
    expect(ufsOf([{ uf: 'SP' }, { uf: null }, { uf: 'BA' }, { uf: 'SP' }])).toEqual(['BA', 'SP'])
    expect(galleriesHref({})).toBe('/e/galleries')
    expect(galleriesHref({ q: 'la', uf: 'BA', tag: 'Pintura' })).toBe('/e/galleries?q=la&uf=BA&tag=Pintura')
  })
})
