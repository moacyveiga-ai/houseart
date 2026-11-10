import { describe, expect, it } from 'vitest'
import { REF_MM, SOFA, wallLayout } from './wall-scene-core'

const ratio = (a: number, b: number) => Math.round((a / b) * 1000) / 1000

describe('wallLayout — one real scale for the work, the sofa and the ruler', () => {
  it('the work keeps its real size against the 2,20 m sofa, whatever the stage shape', () => {
    for (const stage of [{ width: 760, height: 700 }, { width: 1200, height: 700 }, { width: 380, height: 520 }]) {
      const l = wallLayout(stage, { widthMm: 800, heightMm: 1000 })!
      expect(ratio(l.work.width, l.sofa.body.width)).toBe(ratio(800, SOFA.widthMm))
      expect(ratio(l.work.height, l.ruler.height)).toBe(ratio(1000, REF_MM))
      expect(ratio(l.work.width, l.work.height)).toBe(0.8)
    }
  })

  it('hangs a small work on the eye line and a big one 25 cm over the sofa back', () => {
    const small = wallLayout({ width: 900, height: 700 }, { widthMm: 400, heightMm: 500 })!
    expect(Math.round((small.work.bottom - small.floor + small.work.height / 2) / small.k)).toBe(1550)
    const big = wallLayout({ width: 900, height: 700 }, { widthMm: 1500, heightMm: 1200 })!
    expect(Math.round((big.work.bottom - big.floor) / big.k)).toBe(SOFA.heightMm + 250)
  })

  it('a huge work shrinks the whole scene to fit the stage (still in proportion)', () => {
    const l = wallLayout({ width: 900, height: 700, topReserve: 56 }, { widthMm: 5000, heightMm: 5000 })!
    expect(l.work.bottom + l.work.height).toBeLessThanOrEqual(700 - 56 + 0.5)
    expect(l.work.width).toBeLessThanOrEqual(900 * 0.8 + 0.5)
    expect(ratio(l.work.width, l.sofa.body.width)).toBe(ratio(5000, SOFA.widthMm))
  })

  it('no size, no scene', () => {
    expect(wallLayout({ width: 0, height: 700 }, { widthMm: 500, heightMm: 500 })).toBeNull()
    expect(wallLayout({ width: 900, height: 700 }, { widthMm: 0, heightMm: 500 })).toBeNull()
  })
})
