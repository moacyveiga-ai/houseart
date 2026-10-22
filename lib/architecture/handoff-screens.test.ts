// The handoff of 2026-10-21 is inventoried in handoff-screens.ts: every
// prototype file is listed, the mobile shortcut lists match the prototypes,
// every mapped page exists and the pending count only shrinks.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HANDOFF_SCREENS, handoffPending } from './handoff-screens'
import { ROOT } from './source-graph'

const DIR = join(ROOT, 'houseart-design/handoff/designs')
const PENDING_BASELINE = 61
const NOT_SCREENS = ['HouseArt Design System', 'HouseArt Pitch']

const shortcuts = (file: string) => {
  const html = readFileSync(join(DIR, `${file}.dc.html`), 'utf8')
  const i = html.indexOf('out.atalhos = [')
  const block = html.slice(i, i + 8000)
  return [...block.matchAll(/\[\s*'([^']+)'\s*,\s*'[\w_]+'\s*,/g)].map((m) => m[1])
}

describe('design handoff ratchet', () => {
  it('every prototype file is inventoried', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.dc.html')).map((f) => f.replace(/\.dc\.html$/, ''))
    const expected = files.filter((f) => !NOT_SCREENS.includes(f)).sort()
    expect(Object.keys(HANDOFF_SCREENS).sort()).toEqual(expected)
  })

  it('the mobile shortcut lists match the prototypes', () => {
    for (const app of ['HouseArt App Colecionador', 'HouseArt App Galeria']) {
      expect(Object.keys(HANDOFF_SCREENS[app])).toEqual(shortcuts(app))
    }
    // App Artista (older prototype) builds `atalhos: [[nome, icon, go, key], …]` inline.
    const artista = readFileSync(join(DIR, 'HouseArt App Artista.dc.html'), 'utf8')
    const i = artista.indexOf('atalhos: [')
    const named = [...artista.slice(i, i + 2000).matchAll(/\['([^']+)',\s*'[\w_]+',\s*(?:go\(|\(\) =>)/g)].map((m) => m[1])
    expect(Object.keys(HANDOFF_SCREENS['HouseArt App Artista'])).toEqual(named)
  })

  it('every mapped page exists', () => {
    const missing = Object.entries(HANDOFF_SCREENS).flatMap(([file, m]) =>
      Object.entries(m).filter(([, p]) => p && !existsSync(join(ROOT, p))).map(([k]) => `${file} › ${k}`),
    )
    expect(missing).toEqual([])
  })

  it('the pending list only shrinks', () => {
    expect(handoffPending()).toBeLessThanOrEqual(PENDING_BASELINE)
  })
})
