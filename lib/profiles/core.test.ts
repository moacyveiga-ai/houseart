import { describe, expect, it } from 'vitest'
import { availableCards, initialsOf, memberKindOf, navProfileOf, PROFILE_CARDS } from './core'

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
})
