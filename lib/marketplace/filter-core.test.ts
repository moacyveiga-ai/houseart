import { describe, expect, it } from 'vitest'
import { countFor, EMPTY_SELECTION, paramsOf, passes, selectionFromParams, sizeKeyOf, sortItems, toggleIn, type MarketItem } from './filter-core'

const item = (o: Partial<MarketItem>): MarketItem => ({ publicId: 'HA-1', artist: 'Joana Teixeira', artistSlug: 'joana', title: 'Construção nº 7', year: 2025, category: 'PAINTING', technique: 'Óleo', dimensions: '100 × 80 cm', sizeKey: 'MEDIUM', priceCents: 3_800_000n, saleMode: 'FIXED', seller: 'Galeria Ladeira', sellerKind: 'GALLERY', market: 'PRIMARY', uf: 'BA', cover: null, updatedAt: 1, ...o })

describe('marketplace filter core', () => {
  it('sizes by the largest side', () => {
    expect(sizeKeyOf(500, 400)).toBe('SMALL'); expect(sizeKeyOf(1000, 800)).toBe('MEDIUM'); expect(sizeKeyOf(1400, 1050)).toBe('LARGE'); expect(sizeKeyOf(null, null)).toBeNull()
  })
  it('filters by every group and by text without accents', () => {
    const a = item({}); const b = item({ publicId: 'HA-2', category: 'SCULPTURE', priceCents: 320_000_000n, sellerKind: 'PRIVATE', market: 'SECONDARY', uf: 'SP', sizeKey: 'LARGE', artist: 'Tomás Rezende', title: 'Retábulo' })
    expect(passes(a, { ...EMPTY_SELECTION, category: ['PAINTING'] }, '')).toBe(true)
    expect(passes(b, { ...EMPTY_SELECTION, category: ['PAINTING'] }, '')).toBe(false)
    expect(passes(b, { ...EMPTY_SELECTION, price: ['over200'] }, '')).toBe(true)
    expect(passes(a, { ...EMPTY_SELECTION, price: ['over200'] }, '')).toBe(false)
    expect(passes(b, EMPTY_SELECTION, 'retabulo')).toBe(true)
    expect(passes(a, EMPTY_SELECTION, 'retabulo')).toBe(false)
    expect(passes(item({ priceCents: null }), { ...EMPTY_SELECTION, price: ['upto10'] }, '')).toBe(false)
  })
  it('counts an option against the other groups', () => {
    const items = [item({}), item({ publicId: 'HA-2', category: 'SCULPTURE' })]
    const sel = { ...EMPTY_SELECTION, category: ['PAINTING'] }
    expect(countFor(items, sel, '', 'category', 'SCULPTURE')).toBe(1)
    expect(countFor(items, { ...sel, uf: ['SP'] }, '', 'category', 'SCULPTURE')).toBe(0)
  })
  it('sorts with "sob consulta" last and round-trips the URL', () => {
    const items = [item({ publicId: 'a', priceCents: null }), item({ publicId: 'b', priceCents: 100n }), item({ publicId: 'c', priceCents: 50n })]
    expect(sortItems(items, 'lower').map((i) => i.publicId)).toEqual(['c', 'b', 'a'])
    expect(sortItems(items, 'higher').map((i) => i.publicId)).toEqual(['b', 'c', 'a'])
    const sel = toggleIn(toggleIn(EMPTY_SELECTION, 'category', 'PAINTING'), 'uf', 'BA')
    expect(paramsOf(sel, 'mar', 'recent')).toBe('?category=PAINTING&uf=BA&q=mar&sort=recent')
    expect(selectionFromParams({ category: 'PAINTING,SCULPTURE', uf: 'BA' })).toEqual({ ...EMPTY_SELECTION, category: ['PAINTING', 'SCULPTURE'], uf: ['BA'] })
    expect(selectionFromParams({ category: 'WORK_ON_PAPER,PRINT' }).category).toEqual(['PRINT'])
    expect(toggleIn(sel, 'uf', 'BA').uf).toEqual([])
  })
})
