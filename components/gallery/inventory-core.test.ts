import { describe, expect, it } from 'vitest'
import { chipCounts, chipKey, emptyText, inventoryHref, filterInventory, matchesQuery, rowPrice, rowStats, rowStatus, summaryLine, type InventoryItem } from './inventory-core'

const w = (p: Partial<InventoryItem> & { id: number; status: InventoryItem['status'] }): InventoryItem => ({ title: 'Obra', year: 2024, artistName: 'Artista', listPriceCents: null, saleMode: null, publicId: null, coverUrl: null, ...p })
const items = [
  w({ id: 1, status: 'LISTED', title: 'Construção nº 7', artistName: 'Joana Teixeira', listPriceCents: 3800000n, saleMode: 'FIXED_WITH_OFFERS', publicId: 'HA-2026-7K3F-9Q2M', listing: { views7d: 1240, openOffers: 2, paused: false, saves: 46 } }),
  w({ id: 2, status: 'LISTED', title: 'Voo baixo', listPriceCents: 4400000n, saleMode: 'FIXED', listing: { views7d: 0, openOffers: 0, paused: true } }),
  w({ id: 3, status: 'IN_DEAL', title: 'Duas luas', listPriceCents: 18500000n, deal: { buyerName: 'Helena Vaz', phase: 'DOCUMENTS', sellerSigned: true, exception: null } }),
  w({ id: 4, status: 'SOLD', title: 'Maré' }),
  w({ id: 5, status: 'IN_CERTIFICATION', title: 'Retábulo' }),
  w({ id: 6, status: 'DRAFT', title: 'Sem título' }),
  w({ id: 7, status: 'AUTHENTICATED', title: 'Luz' }),
]

describe('inventory-core', () => {
  it('maps the chips over the statuses and counts them', () => {
    expect(chipCounts(items)).toEqual({ all: 7, listed: 2, reserved: 1, sold: 1, authenticated: 1, certifying: 1, drafts: 1 })
    expect(chipKey('reserved')).toBe('reserved'); expect(chipKey('x')).toBe('all'); expect(chipKey(undefined)).toBe('all')
  })
  it('searches by title, artist or certificate, ignoring accents and case', () => {
    expect(matchesQuery(items[0], 'construcao')).toBe(true)
    expect(matchesQuery(items[0], 'teixeira')).toBe(true)
    expect(matchesQuery(items[0], '7k3f')).toBe(true)
    expect(matchesQuery(items[0], 'voo')).toBe(false)
    expect(filterInventory(items, 'listed', 'voo').map((a) => a.id)).toEqual([2])
    expect(filterInventory(items, 'all', '').length).toBe(7)
  })
  it('sums only the listed prices in the summary', () => {
    expect(summaryLine(items).replace(/\u00a0/g, ' ')).toBe('7 obras · R$ 82.000 à venda')
    expect(summaryLine([]).replace(/\u00a0/g, ' ')).toBe('0 obras · R$ 0 à venda')
    expect(summaryLine([items[3]]).replace(/\u00a0/g, ' ')).toBe('1 obra · R$ 0 à venda')
  })
  it('gives each row its pill, price and stats line', () => {
    expect(rowStatus(items[0])).toEqual({ label: 'À venda', tone: 'verified' })
    expect(rowStatus(items[1])).toEqual({ label: 'Pausada', tone: 'neutral' })
    expect(rowStatus(items[2])).toEqual({ label: 'Reservada', tone: 'sand' })
    expect(rowStatus(items[4])).toEqual({ label: 'Em certificação', tone: 'pending' })
    expect(rowPrice(items[0]).replace(/\u00a0/g, ' ')).toBe('R$ 38.000')
    expect(rowPrice({ saleMode: 'ON_REQUEST', listPriceCents: 1n })).toBe('Sob consulta')
    expect(rowPrice(items[3])).toBe('—')
    expect(rowStats(items[0])).toBe('1.240 views · 7 dias · 46 salvos · 2 ofertas')
    expect(rowStats(items[1])).toBe('0 views · 7 dias')
    expect(rowStats(items[2])).toBe('Vendida para Helena Vaz · registrar envio')
    expect(rowStats({ status: 'IN_DEAL', deal: { buyerName: 'Helena Vaz', phase: 'ESCROW', sellerSigned: false, exception: null } })).toBe('Vendida para Helena Vaz · assinar termo')
    expect(rowStats({ status: 'IN_DEAL', deal: { buyerName: 'Helena Vaz', phase: 'OFFER_ACCEPTED', sellerSigned: false, exception: null } })).toBe('Reservada para Helena Vaz · aguardando pagamento')
    expect(rowStats({ status: 'IN_DEAL' })).toBe('Negócio em andamento')
    expect(rowStats(items[5])).toMatch(/certificação/)
  })
  it('has an empty text for the filter and for the search', () => {
    expect(emptyText('')).toBe('Nenhuma obra neste filtro.')
    expect(emptyText(' luz ')).toBe('Nenhuma obra para “luz”.')
  })
  it('href keeps the chip and drops an empty search', () => {
    expect(inventoryHref('listed', '')).toBe('/artworks?filter=listed')
    expect(inventoryHref('listed', '  Ana & Co ')).toBe('/artworks?filter=listed&q=Ana%20%26%20Co')
  })
})
