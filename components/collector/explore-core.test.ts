import { describe, expect, it } from 'vitest'
import { chipOf, deckCounter, discoverOrder, exploreHref, marketLabel, passesChip, sellerSubOf, sheetLineOf, viewOf, type ExploreItem } from './explore-core'

const item = (over: Partial<ExploreItem> = {}): ExploreItem => ({ id: 1, publicId: 'HA-1', title: 'T', year: 2024, artist: 'A', category: 'PAINTING', priceCents: '500000', saleMode: 'FIXED_WITH_OFFERS', cover: null, technique: 'Óleo', dimensions: '50 × 40 cm', seller: 'G', sellerKind: 'GALLERY', market: 'PRIMARY', uf: 'BA', liked: false, saved: false, likes: 0, comments: 0, city: 'Salvador', sellerHref: null, ...over })

describe('explore-core', () => {
  it('chips filter like the prototype', () => {
    expect(passesChip(item(), 'all')).toBe(true)
    expect(passesChip(item(), 'PAINTING')).toBe(true)
    expect(passesChip(item(), 'PHOTOGRAPHY')).toBe(false)
    expect(passesChip(item(), 'upto10k')).toBe(true)
    expect(passesChip(item({ priceCents: '1000001' }), 'upto10k')).toBe(false)
    expect(passesChip(item({ priceCents: null }), 'upto10k')).toBe(false)
    expect(passesChip(item({ saleMode: 'FIXED' }), 'offers')).toBe(false)
  })
  it('reads the url', () => {
    expect(chipOf('zzz')).toBe('all'); expect(chipOf('offers')).toBe('offers')
    expect(viewOf(undefined)).toBe('feed'); expect(viewOf('discover')).toBe('discover')
    expect(exploreHref('feed', 'all')).toBe('/explore')
    expect(exploreHref('discover', 'PAINTING')).toBe('/explore?view=discover&cat=PAINTING')
  })
  it('labels', () => {
    expect(deckCounter(2, 12)).toBe('3 de 12 · arraste para a direita para curtir')
    expect(sheetLineOf({ technique: null, dimensions: '—' }, 'Pintura')).toBe('Pintura')
  })

  it('head of the post: who sells and where; resale instead of secondary', () => {
    expect(sellerSubOf(item())).toBe('Galeria · Salvador, BA')
    expect(sellerSubOf(item({ sellerKind: 'PRIVATE', city: null }))).toBe('Colecionador · BA')
    expect(sellerSubOf(item({ sellerKind: 'PRIVATE', city: null, uf: null }))).toBe('Colecionador')
    expect(marketLabel('SECONDARY')).toBe('Revenda')
    expect(marketLabel('PRIMARY')).toBe('Primário')
  })

  it('Descobrir: artists of liked works first, the rest in marketplace order', () => {
    const a = item({ id: 1, artist: 'Ana', liked: true })
    const b = item({ id: 2, artist: 'Bia' })
    const c = item({ id: 3, artist: 'Ana' })
    const d = item({ id: 4, artist: 'Bia', saved: true })
    const e = item({ id: 5, artist: 'Ana' })
    expect(discoverOrder([a, b, c, d, e]).map((i) => i.id)).toEqual([1, 3, 5, 2, 4])
    expect(discoverOrder([b, c]).map((i) => i.id)).toEqual([2, 3])
  })
})
