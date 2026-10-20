// A `--ha-*` token used and never defined invalidates the WHOLE declaration
// (the text inherits the colour of the background). Ratchet: every
// `var(--ha-x)` WITHOUT fallback must be defined in some .css of app/ or components/.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (name === 'generated' || name === 'node_modules') return []
    if (statSync(p).isDirectory()) return files(p, ext)
    return ext.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

const css = [...files(path.join(ROOT, 'app'), /\.css$/), ...files(path.join(ROOT, 'components'), /\.css$/)]
const defined = new Set(css.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/(--ha-[a-z0-9-]+)\s*:/g)].map((m) => m[1])))

describe('--ha-* tokens used without fallback exist', () => {
  it('the reader sees the tokens', () => {
    expect(defined.has('--ha-sand-500')).toBe(true)
    expect(defined.has('--ha-fg')).toBe(true)
    expect(defined.has('--ha-font-display')).toBe(true)
  })

  it('no var(--ha-x) without fallback points to a missing token', () => {
    const sources = ['app', 'components', 'lib'].flatMap((d) => files(path.join(ROOT, d), /\.(tsx?|css)$/))
    const orphans: string[] = []
    for (const f of sources) {
      for (const m of readFileSync(f, 'utf8').matchAll(/var\((--ha-[a-z0-9-]+)\s*\)/g)) {
        // `--ha-cols` / `--ha-table-min` are per-element custom properties set inline by the Table primitive
        if (m[1] === '--ha-cols' || m[1] === '--ha-table-min') continue
        if (!defined.has(m[1])) orphans.push(`${path.relative(ROOT, f)} → ${m[1]}`)
      }
    }
    expect(orphans).toEqual([])
  })
})
