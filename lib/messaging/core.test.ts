import { describe, expect, it } from 'vitest'
import { checkMessage, CONTACT_GUARD, hasContactLeak, pairOf, previewOf, whenLabel } from './core'

describe('messaging core', () => {
  it('refuses phone, e-mail, link, WhatsApp and Pix', () => {
    for (const t of ['me liga 71 99999-1234', 'escreve joana@gmail.com', 'veja https://site.com', 'www.site.com', 'wa.me/5571', 'pix: 123'])
      expect(hasContactLeak(t), t).toBe(true)
    expect(hasContactLeak('A obra mede 120 x 90 cm e custa R$ 12.500')).toBe(false)
    expect(checkMessage('me liga 71 99999-1234')).toMatchObject({ ok: false, code: 'CONTACT', error: CONTACT_GUARD })
  })
  it('trims, refuses empty and too long', () => {
    expect(checkMessage('  olá  ')).toEqual({ ok: true, body: 'olá' })
    expect(checkMessage('   ')).toMatchObject({ ok: false, code: 'EMPTY' })
    expect(checkMessage('a'.repeat(2001))).toMatchObject({ ok: false, code: 'TOO_LONG' })
  })
  it('orders the pair and previews', () => {
    expect(pairOf(9, 2)).toEqual({ userAId: 2, userBId: 9 })
    expect(previewOf('Olá', true, 'TEXT')).toBe('Você: Olá')
    expect(previewOf('Proposta enviada', true, 'SYSTEM')).toBe('Proposta enviada')
    expect(whenLabel(new Date(Date.now() - 3 * 3_600_000))).toBe('há 3 h')
  })
})
