import { describe, expect, it } from 'vitest'
import { agendaOf, dayMonthOf, draftsAction, offerSub, topStats, unansweredAction } from './panel-core'

describe('gallery panel core', () => {
  it('day and month of a date', () => {
    expect(dayMonthOf('2026-11-03')).toEqual({ day: '03', month: 'nov' })
    expect(dayMonthOf('2026-13-03')).toBeNull()
    expect(dayMonthOf('amanhã')).toBeNull()
  })
  it('agenda: upcoming, sorted, deduped, capped', () => {
    const items = agendaOf([
      { key: 'b', startsOn: '2026-11-10', title: 'Feira', sub: 'SP', kind: 'AGENDA', href: '/x' },
      { key: 'a', startsOn: '2026-11-03', title: 'Abertura', sub: 'Galeria', kind: 'OPENING', href: '/y' },
      { key: 'a', startsOn: '2026-11-03', title: 'Abertura', sub: 'Galeria', kind: 'GOING', href: '/y' },
      { key: 'old', startsOn: '2026-10-01', title: 'Passado', sub: '', kind: 'AGENDA', href: '/z' },
    ], '2026-10-26', 5)
    expect(items.map((i) => i.key)).toEqual(['a', 'b'])
    expect(items[0]).toMatchObject({ day: '03', month: 'nov', icon: 'celebration' })
  })
  it('actions from counts', () => {
    expect(unansweredAction([])).toBeNull()
    expect(unansweredAction(['Helena', 'Marcelo', 'Lia', 'Bia'])).toMatchObject({ title: '4 mensagens sem resposta', sub: 'Helena, Marcelo, Lia e mais 1', tag: 'responder' })
    expect(draftsAction(0)).toBeNull()
    expect(draftsAction(1)?.title).toBe('1 obra sem certificado')
  })
  it('offer line and top stats', () => {
    expect(offerSub({ artworkTitle: 'Construção nº 7', buyer: 'Helena Vaz', pctOfPrice: 89, differenceLabel: '−R$ 4.000' })).toBe('Construção nº 7 · Helena Vaz · 89% do preço')
    expect(offerSub({ artworkTitle: 'Obra', buyer: 'Ana', pctOfPrice: null, differenceLabel: '' })).toBe('Obra · Ana')
    expect(topStats({ saves: 1, likes: 214, openOffers: 2 })).toBe('1 salvo · 214 curtidas · 2 ofertas')
  })
})
