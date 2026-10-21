// Every `data-screen-label` of the design has an entry in SCREEN_MAP, and
// every mapped page exists. The pending list only shrinks.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCREEN_MAP } from './screen-map'
import { ROOT } from './source-graph'

const PENDING_BASELINE = 0

describe('design screens ratchet', () => {
  const html = readFileSync(join(ROOT, 'houseart-design/screens.html'), 'utf8')
  const labels = [...html.matchAll(/data-screen-label="([^"]+)"/g)].map((m) => m[1])

  it('the 17 screens of the design are all mapped', () => {
    expect(labels).toHaveLength(17)
    expect(labels.filter((l) => !(l in SCREEN_MAP))).toEqual([])
    expect(Object.keys(SCREEN_MAP).filter((k) => !labels.includes(k))).toEqual([])
  })

  it('every mapped page exists', () => {
    const missing = Object.entries(SCREEN_MAP).filter(([, p]) => p && !existsSync(join(ROOT, p))).map(([k]) => k)
    expect(missing).toEqual([])
  })

  it('the pending list only shrinks', () => {
    const pending = Object.values(SCREEN_MAP).filter((p) => p === null).length
    expect(pending).toBeLessThanOrEqual(PENDING_BASELINE)
  })
})
