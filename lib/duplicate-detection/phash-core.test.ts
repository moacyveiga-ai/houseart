import { describe, expect, it } from 'vitest'
import { dHash, hammingDistance, similarityBps } from './phash-core'

describe('dHash', () => {
  it('is stable and sees differences', () => {
    const grad = Array.from({ length: 72 }, (_, i) => 200 - (i % 9) * 20)
    const flat = new Array(72).fill(100)
    expect(dHash(grad)).toBe(dHash(grad))
    expect(dHash(grad)).toHaveLength(16)
    expect(hammingDistance(dHash(grad), dHash(grad))).toBe(0)
    expect(similarityBps(dHash(grad), dHash(flat))).toBeLessThan(10000)
    expect(similarityBps('0000000000000000', 'ffffffffffffffff')).toBe(0)
  })
})
