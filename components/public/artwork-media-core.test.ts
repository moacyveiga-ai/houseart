import { describe, expect, it } from 'vitest'
import { mediaItemsOf } from './artwork-media-core'

describe('mediaItemsOf', () => {
  it('shows the real photos in the order of the strip and skips the missing ones', () => {
    const items = mediaItemsOf([{ kind: 'IN_SITU', url: 'w' }, { kind: 'SIGNATURE', url: 's' }, { kind: 'FRONT_COLOR_CARD', url: 'f' }, { kind: 'MACRO_TL', url: 'm' }, { kind: 'BACK', url: 'b' }])
    expect(items.map((i) => [i.label, i.src, i.view])).toEqual([['Frente', 'f', 'front'], ['Verso e etiqueta', 'b', 'back'], ['Assinatura', 's', 'photo'], ['Na parede', 'w', 'photo']])
  })
  it('falls back to the zoomed front only when there is no close-up at all', () => {
    const items = mediaItemsOf([{ kind: 'FRONT_COLOR_CARD', url: 'f' }, { kind: 'BACK', url: 'b' }])
    expect(items.map((i) => i.label)).toEqual(['Frente', 'Verso e etiqueta', 'Detalhe 1', 'Detalhe 2'])
    expect(items[2]).toMatchObject({ src: 'f', view: 'detail', origin: '30% 25%' })
    expect(mediaItemsOf([{ kind: 'FRONT_COLOR_CARD', url: 'f' }, { kind: 'DETAIL', url: 'd' }]).map((i) => i.label)).toEqual(['Frente', 'Detalhe'])
    expect(mediaItemsOf([{ kind: 'FRONT_COLOR_CARD', url: 'f' }, { kind: 'SIGNATURE', url: 's' }]).map((i) => i.label)).toEqual(['Frente', 'Assinatura'])
    expect(mediaItemsOf([{ kind: 'BACK', url: 'b' }]).map((i) => i.label)).toEqual(['Verso e etiqueta'])
    expect(mediaItemsOf([])).toEqual([])
  })
})
