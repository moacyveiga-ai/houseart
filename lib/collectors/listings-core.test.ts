import { describe, expect, it } from 'vitest'
import { modeLine, statsLine } from './listings-core'

describe('active listings lines', () => {
  it('mode: offers, fixed, paused wins', () => {
    expect(modeLine({ saleMode: 'FIXED_WITH_OFFERS', paused: false })).toBe('aceita ofertas')
    expect(modeLine({ saleMode: 'FIXED', paused: false })).toBe('preço fixo')
    expect(modeLine({ saleMode: 'FIXED', paused: true })).toBe('pausado')
    expect(modeLine({ saleMode: null, paused: false })).toBe('aceita ofertas')
  })
  it('stats with plurals', () => {
    expect(statsLine({ views: 312, likes: 64, comments: 0 })).toBe('312 visualizações em 7 dias · 64 curtidas · 0 comentários')
    expect(statsLine({ views: 1, likes: 1, comments: 1 })).toBe('1 visualização em 7 dias · 1 curtida · 1 comentário')
  })
})
