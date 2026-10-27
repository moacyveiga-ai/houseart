import { describe, expect, it } from 'vitest'
import { filterKey, listHref, pageOf, parseQuery, versionsLine } from './core'

describe('admin artworks core', () => {
  it('reads the search as public id, id or text', () => {
    expect(parseQuery(' ha-2026-abcd-efgh ')).toEqual({ publicId: 'HA-2026-ABCD-EFGH', id: null, text: '' })
    expect(parseQuery('#12')).toEqual({ publicId: null, id: 12, text: '' })
    expect(parseQuery('42')).toEqual({ publicId: null, id: 42, text: '' })
    expect(parseQuery('Mar azul')).toEqual({ publicId: null, id: null, text: 'Mar azul' })
    expect(parseQuery('')).toEqual({ publicId: null, id: null, text: '' })
  })
  it('filter key falls back to all', () => {
    expect(filterKey('alert')).toBe('alert')
    expect(filterKey('nope')).toBe('all')
  })
  it('page inside 1..last', () => {
    expect(pageOf(undefined, 120)).toEqual({ page: 1, pages: 3 })
    expect(pageOf('9', 120)).toEqual({ page: 3, pages: 3 })
    expect(pageOf('-1', 0)).toEqual({ page: 1, pages: 1 })
  })
  it('href keeps search and filter, drops defaults', () => {
    expect(listHref({})).toBe('/admin/review/artworks')
    expect(listHref({ q: 'Ana', f: 'listed', page: 2 })).toBe('/admin/review/artworks?q=Ana&f=listed&page=2')
    expect(listHref({ f: 'all', page: 1 })).toBe('/admin/review/artworks')
  })
  it('versions line', () => {
    expect(versionsLine([])).toBe('sem versão emitida')
    expect(versionsLine([{ version: 1, status: 'ACTIVE' }])).toBe('v1')
    expect(versionsLine([{ version: 1, status: 'SUPERSEDED' }, { version: 2, status: 'SUPERSEDED' }, { version: 3, status: 'ACTIVE' }])).toBe('v3 · 2 anteriores')
  })
})
