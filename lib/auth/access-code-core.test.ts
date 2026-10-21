import { describe, expect, it } from 'vitest'
import { newCode, sha256, verifyCode } from './access-code-core'

const now = new Date('2026-10-21T10:00:00Z')
const base = { purpose: 'LOGIN', codeHash: sha256('123456'), attempts: 1, blockedUntil: null, expiresAt: new Date('2026-10-21T10:10:00Z'), consumedAt: null }

describe('verifyCode', () => {
  it('accepts the right code and refuses the rest with the same vocabulary', () => {
    expect(verifyCode(base, '123456', now)).toEqual({ ok: true })
    expect(verifyCode(base, '654321', now)).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: 4 })
    expect(verifyCode({ ...base, attempts: 5 }, '654321', now)).toMatchObject({ ok: false, block: true, attemptsLeft: 0 })
    expect(verifyCode({ ...base, expiresAt: now }, '123456', now)).toMatchObject({ ok: false, reason: 'expired' })
    expect(verifyCode({ ...base, consumedAt: now }, '123456', now)).toMatchObject({ ok: false, reason: 'consumed' })
  })
  it('a SILENT row never opens, even with its own code', () => {
    expect(verifyCode({ ...base, purpose: 'SILENT' }, '123456', now).ok).toBe(false)
  })
  it('newCode is 6 digits', () => {
    expect(newCode()).toMatch(/^\d{6}$/)
  })
})
