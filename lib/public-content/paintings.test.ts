import { describe, expect, it } from 'vitest'
import { WALL_PAINTINGS, randomWall } from './paintings'

describe('randomWall', () => {
  it('picks from the wall list at both ends of the random range', () => {
    expect(randomWall(() => 0).src).toBe(WALL_PAINTINGS[0].src)
    expect(randomWall(() => 0.9999).src).toBe(WALL_PAINTINGS[WALL_PAINTINGS.length - 1].src)
    expect(randomWall(() => 0).credit).toMatch(/domínio público$/)
  })
  it('never uses the low-resolution Saudade', () => {
    expect(WALL_PAINTINGS.some((p) => p.title === 'Saudade')).toBe(false)
  })
})
