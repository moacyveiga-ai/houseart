import { describe, expect, it } from 'vitest'
import { categoryChip, isAll, panelQuery, parsePanelFilter, toggleHref } from './panel-filter-core'

describe('panel marketplace filters', () => {
  it('combines chips and ignores unknown ones', () => {
    const f = parsePanelFilter({ f: 'ba,painting,xx,ba' })
    expect(f.chips).toEqual(['painting', 'ba'])
    expect(panelQuery(f)).toEqual({ category: 'PAINTING', maxPriceCents: null, market: null, uf: 'BA' })
  })
  it('toggles a chip on and off keeping the others', () => {
    const f = parsePanelFilter({ f: 'painting' })
    expect(toggleHref(f, 'under50')).toBe('/marketplace?f=painting%2Cunder50')
    expect(toggleHref(f, 'painting')).toBe('/marketplace')
  })
  it('a category from the search is kept, removable, and replaced by "Pintura"', () => {
    const f = parsePanelFilter({ category: 'SCULPTURE', f: 'ba' })
    expect(panelQuery(f).category).toBe('SCULPTURE')
    expect(categoryChip(f)).toEqual({ label: 'Escultura', clearHref: '/marketplace?f=ba' })
    expect(toggleHref(f, 'painting')).toBe('/marketplace?f=painting%2Cba')
    expect(parsePanelFilter({ category: 'NOPE' }).category).toBeNull()
    expect(isAll(parsePanelFilter({}))).toBe(true)
  })
})
