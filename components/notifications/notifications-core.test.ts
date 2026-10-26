import { describe, expect, it } from 'vitest'
import { iconOf, toneOf, vapidKeyBytes, whenShort } from './notifications-core'

describe('avisos — ícone, tom e carimbo', () => {
  it('o ícone segue o prefixo do kind', () => {
    expect(iconOf('offer.received')).toBe('handshake')
    expect(iconOf('review.opened')).toBe('fact_check')
    expect(iconOf('message.received')).toBe('chat_bubble')
    expect(iconOf('community.liked')).toBe('forum')
    expect(iconOf('deal.shipped')).toBe('local_shipping')
    expect(iconOf('certificate.issued')).toBe('contract')
    expect(iconOf('whatever')).toBe('notifications')
  })
  it('certificado é verde; o resto depende de lido', () => {
    expect(toneOf({ kind: 'certificate.issued', readAt: null })).toBe('verified')
    expect(toneOf({ kind: 'offer.received', readAt: null })).toBe('unread')
    expect(toneOf({ kind: 'offer.received', readAt: '2026-10-22T10:00:00Z' })).toBe('read')
  })
  it('o carimbo curto', () => {
    const now = new Date('2026-10-22T15:00:00Z')
    expect(whenShort('2026-10-22T14:59:40Z', now)).toBe('agora')
    expect(whenShort('2026-10-22T14:30:00Z', now)).toBe('30 min')
    expect(whenShort('2026-10-22T12:00:00Z', now)).toBe('3 h')
    expect(whenShort('2026-10-21T12:00:00Z', now)).toBe('ontem')
    expect(whenShort('2026-03-02T12:00:00Z', now)).toBe('02/03')
  })
  it('a chave VAPID vira bytes', () => {
    expect([...vapidKeyBytes('AQID')]).toEqual([1, 2, 3])
    expect([...vapidKeyBytes('-_8')]).toEqual([251, 255])
  })
})
