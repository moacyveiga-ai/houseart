import { describe, expect, it } from 'vitest'
import { canonical, chainHash, chainValid, holderLabel, merkleRoot } from './core'

describe('certificate core', () => {
  it('canonical sorts keys and drops undefined', () => {
    expect(canonical({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[2,{"y":2,"z":1}]},"b":1}')
  })
  it('chain hashes link and validate', () => {
    const h1 = chainHash(null, { kind: 'CREATED' })
    const h2 = chainHash(h1, { kind: 'CERTIFIED' })
    expect(chainValid([{ payloadJson: '{"kind":"CREATED"}', hash: h1, prevHash: null }, { payloadJson: '{"kind":"CERTIFIED"}', hash: h2, prevHash: h1 }])).toBe(true)
    expect(chainValid([{ payloadJson: '{"kind":"CREATED"}', hash: h1, prevHash: null }, { payloadJson: '{"kind":"STOLEN"}', hash: h2, prevHash: h1 }])).toBe(false)
  })
  it('merkle root is deterministic', () => {
    expect(merkleRoot(['a', 'b', 'c'])).toBe(merkleRoot(['a', 'b', 'c']))
    expect(merkleRoot(['a'])).not.toBe(merkleRoot(['b']))
    expect(merkleRoot([])).toHaveLength(64)
  })
  it('holder label anonymizes collectors', () => {
    expect(holderLabel({ kind: 'COLLECTOR', name: 'Marcelo', since: new Date('2026-03-01') })).toBe('Colecionador particular · desde 2026')
    expect(holderLabel({ kind: 'ARTIST', name: 'Joana Teixeira', since: new Date('2026-03-01') })).toBe('Joana Teixeira · desde 2026')
  })
})
