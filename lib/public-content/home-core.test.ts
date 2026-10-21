import { describe, expect, it } from 'vitest'
import { AGENDA_FILTERS, dayPartsOf, filterAgenda, initialMonth, monthKeyOf, monthTabs, newsDateLabel } from './home-core'

describe('home-core', () => {
  it('month key follows the house timezone (UTC−3), not UTC', () => {
    expect(monthKeyOf(new Date('2026-10-31T23:30:00-03:00'))).toBe('2026-10')
    expect(monthKeyOf(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10') // 22h of 31/10 in Bahia
    expect(monthKeyOf(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11')
  })

  it('month tabs cross the year', () => {
    expect(monthTabs('2026-11', 4)).toEqual([
      { key: '2026-11', label: 'Novembro 2026' }, { key: '2026-12', label: 'Dezembro 2026' },
      { key: '2027-01', label: 'Janeiro 2027' }, { key: '2027-02', label: 'Fevereiro 2027' },
    ])
  })

  it('day block and filters', () => {
    expect(dayPartsOf('2026-11-05')).toEqual({ day: '05', mon: 'nov' })
    expect(AGENDA_FILTERS.map((f) => f.label)).toEqual(['Todos', 'Feira', 'Exposição', 'Abertura', 'Leilão'])
    const items = [{ startsOn: '2026-11-05', kind: 'OPENING' }, { startsOn: '2026-11-12', kind: 'FAIR' }, { startsOn: '2026-12-03', kind: 'EXHIBITION' }]
    expect(filterAgenda(items, '2026-11', null)).toHaveLength(2)
    expect(filterAgenda(items, '2026-11', 'FAIR')).toHaveLength(1)
    expect(filterAgenda(items, '2026-12', 'FAIR')).toHaveLength(0)
    expect(initialMonth(monthTabs('2026-10', 4), items)).toBe('2026-11')
    expect(initialMonth(monthTabs('2026-10', 4), [])).toBe('2026-10')
  })

  it('news date label', () => {
    expect(newsDateLabel(new Date('2026-10-18T00:00:00Z'))).toBe('18 out 2026') // calendar date at midnight UTC never slides a day
    expect(newsDateLabel(new Date('2026-01-05T00:00:00Z'))).toBe('5 jan 2026')
  })
})
