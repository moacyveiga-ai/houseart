import { describe, expect, it } from 'vitest'
import { swapTarget } from './core'

const p = (kinds: string[], active: string) => kinds.map((k) => ({ kind: k as never, active: k === active }))

describe('swapTarget', () => {
  it('a galeria vê como colecionador quando tem o perfil', () => {
    expect(swapTarget(p(['GALLERY', 'COLLECTOR'], 'GALLERY'))).toEqual({ kind: 'COLLECTOR', label: 'Ver como colecionador' })
  })
  it('o colecionador vê como o primeiro perfil de venda', () => {
    expect(swapTarget(p(['COLLECTOR', 'ARTIST', 'GALLERY'], 'COLLECTOR'))).toEqual({ kind: 'GALLERY', label: 'Ver como galeria' })
    expect(swapTarget(p(['COLLECTOR', 'ARTIST'], 'COLLECTOR'))).toEqual({ kind: 'ARTIST', label: 'Ver como artista' })
  })
  it('sem a contraparte não há atalho', () => {
    expect(swapTarget(p(['GALLERY'], 'GALLERY'))).toBeNull()
    expect(swapTarget(p(['STAFF', 'COLLECTOR'], 'STAFF'))).toBeNull()
    expect(swapTarget(p(['APPRAISER', 'COLLECTOR'], 'APPRAISER'))).toBeNull()
    expect(swapTarget(p(['COLLECTOR', 'APPRAISER'], 'COLLECTOR'))).toBeNull()
  })
})
