import { describe, expect, it } from 'vitest'
import { aesCmac, mockMasterKey, mockSunMessage, reportsTamper, tamperDecision, tamperOf, verifySun } from './sun-core'
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

describe('tamper flag', () => {
  it('only counts with a valid CMAC (a forged tt=1 link changes nothing)', () => {
    expect(tamperOf(true, { ok: true })).toBe(true)
    expect(tamperOf(true, { ok: false, reason: 'BAD_CMAC' })).toBe(false)
    expect(tamperOf(true, { ok: false, reason: 'REPLAY' })).toBe(false)
    expect(tamperOf(false, { ok: true })).toBe(false)
  })

  it('reads the claim from the mirrored TT status', () => {
    expect(reportsTamper(undefined)).toBe(false)
    expect(reportsTamper('')).toBe(false)
    expect(reportsTamper('CC')).toBe(false)
    expect(reportsTamper('II')).toBe(false)
    for (const v of ['OO', 'OC', 'CO', 'oo', '1']) expect(reportsTamper(v)).toBe(true)
  })

  it('records every claim but revokes only on an authenticated read', () => {
    expect(tamperDecision('OO', { ok: true })).toEqual({ recordFlag: true, revoke: true })
    expect(tamperDecision('1', { ok: false, reason: 'BAD_TT' })).toEqual({ recordFlag: true, revoke: false })
    expect(tamperDecision('OO', { ok: false, reason: 'BAD_CMAC' })).toEqual({ recordFlag: true, revoke: false })
    expect(tamperDecision('OO', { ok: false, reason: 'REPLAY' })).toEqual({ recordFlag: true, revoke: false })
    expect(tamperDecision('CC', { ok: true })).toEqual({ recordFlag: false, revoke: false })
    expect(tamperDecision(undefined, { ok: true })).toEqual({ recordFlag: false, revoke: false })
  })

  it('the TT status is inside the CMAC: appending or changing it breaks the read', () => {
    const uid = '04a1b2c3d4e5f6'
    const master = mockMasterKey()
    const plain = mockSunMessage(uid, 7)
    expect(verifySun({ master, uid, counter: 7, cmac: plain.cmac, lastCounter: 0 })).toEqual({ ok: true })
    // a genuine link without TT mirroring + `&tt=OO` appended by hand
    expect(verifySun({ master, uid, counter: 7, cmac: plain.cmac, lastCounter: 0, tt: 'OO' })).toEqual({ ok: false, reason: 'BAD_CMAC' })
    const opened = mockSunMessage(uid, 8, 'OO')
    expect(opened.tt).toBe('OO')
    expect(verifySun({ master, uid, counter: 8, cmac: opened.cmac, lastCounter: 0, tt: 'OO' })).toEqual({ ok: true })
    // an intact tag's link (`tt=CC`) rewritten to `tt=OO`
    const intact = mockSunMessage(uid, 9, 'CC')
    expect(verifySun({ master, uid, counter: 9, cmac: intact.cmac, lastCounter: 0, tt: 'OO' })).toEqual({ ok: false, reason: 'BAD_CMAC' })
    expect(verifySun({ master, uid, counter: 9, cmac: intact.cmac, lastCounter: 0, tt: '1' })).toEqual({ ok: false, reason: 'BAD_TT' })
  })
})
