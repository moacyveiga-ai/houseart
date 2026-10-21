import { describe, expect, it } from 'vitest'
import { aesCmac, mockMasterKey, mockSunMessage, verifySun } from './sun-core'
import { actionOf, isPublicId, publicIdOf, stageOf } from './domain'

describe('AES-CMAC (RFC 4493 vectors)', () => {
  const key = Buffer.from('2b7e151628aed2a6abf7158809cf4f3c', 'hex')
  it('empty message', () => {
    expect(aesCmac(key, Buffer.alloc(0)).toString('hex')).toBe('bb1d6929e95937287fa37d129b756746')
  })
  it('16-byte message', () => {
    expect(aesCmac(key, Buffer.from('6bc1bee22e409f96e93d7e117393172a', 'hex')).toString('hex')).toBe('070a16b46b4d4144f79bdd9dd04a287c')
  })
  it('40-byte message', () => {
    const m = Buffer.from('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411', 'hex')
    expect(aesCmac(key, m).toString('hex')).toBe('dfa66747de9ae63030ca32611497c827')
  })
})

describe('SUN verification', () => {
  it('accepts the mock message, refuses replay and a wrong mac', () => {
    const m = mockSunMessage('04a1b2c3d4e5f6', 7)
    expect(verifySun({ master: mockMasterKey(), uid: m.uid, counter: m.ctr, cmac: m.cmac, lastCounter: 6 })).toEqual({ ok: true })
    expect(verifySun({ master: mockMasterKey(), uid: m.uid, counter: m.ctr, cmac: m.cmac, lastCounter: 7 })).toEqual({ ok: false, reason: 'REPLAY' })
    expect(verifySun({ master: mockMasterKey(), uid: m.uid, counter: 8, cmac: m.cmac, lastCounter: 6 })).toEqual({ ok: false, reason: 'BAD_CMAC' })
    expect(verifySun({ master: mockMasterKey(), uid: 'zz', counter: 8, cmac: m.cmac, lastCounter: 6 })).toEqual({ ok: false, reason: 'BAD_UID' })
  })
})

describe('public id and stages', () => {
  it('publicId format', () => {
    const id = publicIdOf(2026, new Uint8Array([1, 2, 3, 4, 5]))
    expect(isPublicId(id)).toBe(true)
    expect(id.startsWith('HA-2026-')).toBe(true)
    expect(isPublicId('HA-2026-ILOU-1234')).toBe(false)
  })
  it('stage ladder and action', () => {
    expect(stageOf({ submitted: true, hasOrder: false, orderDelivered: false, linked: false, signed: false, issued: false })).toBe(0)
    expect(stageOf({ submitted: true, hasOrder: true, orderDelivered: true, linked: false, signed: false, issued: false })).toBe(2)
    expect(actionOf(2)).toEqual({ label: 'Vincular no app', action: 'LINK_IN_APP' })
    expect(actionOf(5).action).toBe('VIEW')
  })
})
