import { describe, expect, it } from 'vitest'
import { signJws, timestamp, verifyJws } from './signing'

describe('signing', () => {
  it('signs and verifies a JWS; a tampered body fails', () => {
    const jws = signJws({ hello: 'world' })
    expect(verifyJws(jws)).toEqual({ hello: 'world' })
    const [h, , s] = jws.split('.')
    expect(verifyJws(`${h}.${Buffer.from('{"hello":"x"}').toString('base64url')}.${s}`)).toBeNull()
  })
  it('mock timestamp carries the hash', () => {
    const t = timestamp('abc', new Date('2026-10-21T00:00:00Z'))
    expect(verifyJws(t.token)).toMatchObject({ hash: 'abc', time: '2026-10-21T00:00:00.000Z' })
  })
})
