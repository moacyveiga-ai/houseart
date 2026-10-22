import { describe, expect, it } from 'vitest'
import { paragraphBlocks, readMinutesLabel, readProgress, trailSegments } from './reading-core'

describe('reading-core', () => {
  it('turns paragraphs into p blocks', () => {
    expect(paragraphBlocks(['a', 'b'])).toEqual([{ kind: 'p', text: 'a' }, { kind: 'p', text: 'b' }])
  })
  it('never says 0 minutes', () => {
    expect(readMinutesLabel(0)).toBe('1 min de leitura')
    expect(readMinutesLabel(4)).toBe('4 min de leitura')
  })
  it('progress is clamped to 0..1', () => {
    expect(readProgress(500, 1000, 0, 400)).toBe(0)
    expect(readProgress(500, 1000, 500, 500)).toBe(0.5)
    expect(readProgress(500, 1000, 5000, 500)).toBe(1)
    expect(readProgress(0, 0, 10, 10)).toBe(0)
  })
  it('lights the first steps of the trail', () => {
    expect(trailSegments(2, 5)).toEqual([true, true, false, false, false])
  })
})

describe('numberedBlocks', () => {
  it('numbers only the list items, in order', async () => {
    const { numberedBlocks } = await import('./reading-core')
    const out = numberedBlocks([{ kind: 'p', text: 'a' }, { kind: 'li', text: 'b', sub: '' }, { kind: 'q', text: 'c' }, { kind: 'li', text: 'd', sub: '' }])
    expect(out.map((b) => b.n)).toEqual([null, 1, null, 2])
  })
})
