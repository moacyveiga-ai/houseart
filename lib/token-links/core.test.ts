// Auditoria 2026-10-11 (A-TEN-08/09, Q13/Q14): todo link por token vale 30
// dias a partir da emissão; revogado deixa de abrir na hora.
import { describe, expect, it } from 'vitest'
import { TOKEN_LINK_TTL_MS, isTokenLinkOpen, tokenLinkState } from './core'

const EMITIDO = new Date('2026-10-01T12:00:00.000Z')
const em = (ms: number) => new Date(EMITIDO.getTime() + ms)

describe('tokenLinkState', () => {
  it('abre até 30 dias − 1 ms e fecha no dia 30 exato (Review Focus 2)', () => {
    expect(tokenLinkState({ issuedAt: EMITIDO }, em(TOKEN_LINK_TTL_MS - 1))).toBe('open')
    expect(tokenLinkState({ issuedAt: EMITIDO }, em(TOKEN_LINK_TTL_MS))).toBe('expired')
  })
  it('revogado fecha na hora, mesmo dentro do prazo, e ganha de vencido', () => {
    expect(tokenLinkState({ issuedAt: EMITIDO, revokedAt: em(1000) }, em(2000))).toBe('revoked')
    expect(tokenLinkState({ issuedAt: EMITIDO, revokedAt: em(1000) }, em(TOKEN_LINK_TTL_MS + 1))).toBe('revoked')
  })
  it('revogação no futuro (relógio torto) não fecha antes da hora', () => {
    expect(isTokenLinkOpen({ issuedAt: EMITIDO, revokedAt: em(5000) }, em(1000))).toBe(true)
  })
})
