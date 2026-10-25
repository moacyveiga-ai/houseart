import { describe, expect, it } from 'vitest'
import { availableCards, defaultProfileKind, initialsOf, memberKindOf, navProfileOf, PROFILE_CARDS } from './core'

describe('profiles core', () => {
  it('six cards in the design order', () => {
    expect(PROFILE_CARDS.map((c) => c.name)).toEqual(['Artista', 'Galeria', 'Colecionador', 'Prestador de serviço · avaliador', 'Consultor de arte', 'Equipe HouseArt'])
  })
  it('advisor uses the gallery nav; staff the admin nav', () => {
    expect(navProfileOf('ADVISOR')).toBe('advisor')
    expect(navProfileOf('STAFF')).toBe('admin')
  })
  it('availableCards keeps only own kinds; collector has no member', () => {
    expect(availableCards(['ARTIST', 'COLLECTOR']).map((c) => c.kind)).toEqual(['ARTIST', 'COLLECTOR'])
    expect(memberKindOf('COLLECTOR')).toBeNull()
    expect(initialsOf('Joana Teixeira')).toBe('JT')
  })
  it('defaultProfileKind: the account default when still available, else the first card, null without cards', () => {
    const cards = availableCards(['COLLECTOR', 'ARTIST'])
    expect(defaultProfileKind(cards, 'COLLECTOR')).toBe('COLLECTOR')
    expect(defaultProfileKind(cards, 'GALLERY')).toBe('ARTIST')
    expect(defaultProfileKind(cards, null)).toBe('ARTIST')
    expect(defaultProfileKind([], null)).toBeNull()
  })
})
