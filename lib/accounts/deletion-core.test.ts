import { describe, expect, it } from 'vitest'
import { deletionBlocker, typedOk } from './deletion-core'

describe('account deletion core', () => {
  it('blocks while there is a negotiation, and says which', () => {
    expect(deletionBlocker({ offers: 0, deals: 0, transfers: 0, listings: 0 })).toBeNull()
    expect(deletionBlocker({ offers: 2, deals: 1, transfers: 0, listings: 0 })).toBe('Você tem 1 negócio em andamento e 2 ofertas abertas. Conclua, retire ou cancele antes de excluir a conta.')
    expect(deletionBlocker({ offers: 0, deals: 0, transfers: 1, listings: 0 })).toContain('1 transferência em andamento')
    expect(deletionBlocker({ offers: 1, deals: 0, transfers: 0, listings: 2 })).toBe('Você tem 1 oferta aberta e 2 obras à venda. Conclua, retire ou cancele antes de excluir a conta.')
  })
  it('the word must be typed', () => {
    expect(typedOk('excluir')).toBe(true)
    expect(typedOk(' EXCLUIR ')).toBe(true)
    expect(typedOk('sim')).toBe(false)
    expect(typedOk(undefined)).toBe(false)
  })
})
