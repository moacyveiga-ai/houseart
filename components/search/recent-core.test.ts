import { describe, expect, it } from 'vitest'
import { parseRecent, pushRecent, removeRecent, RECENT_MAX } from './recent-core'

describe('recent searches', () => {
  it('puts the newest first, moves a repeated term to the top and keeps five', () => {
    let l: string[] = []
    for (const t of ['a', 'b', 'c', 'd', 'e', 'f']) l = pushRecent(l, t)
    expect(l).toEqual(['f', 'e', 'd', 'c', 'b'])
    expect(pushRecent(l, ' C ')).toEqual(['C', 'f', 'e', 'd', 'b'])
    expect(pushRecent(l, '  ')).toEqual(l)
    expect(pushRecent(['Joana'], 'joana')).toEqual(['joana'])
  })
  it('removes ignoring case and reads garbage as empty', () => {
    expect(removeRecent(['Joana', 'Lia'], 'joana')).toEqual(['Lia'])
    expect(parseRecent('not json')).toEqual([])
    expect(parseRecent('{"a":1}')).toEqual([])
    expect(parseRecent(JSON.stringify(['x', 2, '', 'y', 'z', 'w', 'v', 'u']))).toHaveLength(RECENT_MAX)
  })
})
