// Breakpoint ratchet (audit design-system "Breakpoints"): every @media width in the CSS is one of the
// scale documented at the top of app/ds/tokens.css — loose values (600, 640, 1100…) drift the layout.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCALE = new Set([480, 719, 720, 721, 900, 1023, 1024, 1200])
const WIDTH = /\((?:max|min)-width:\s*(\d+)px\)/g

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'generated' || name.startsWith('.')) return []
    return statSync(path).isDirectory() ? cssFiles(path) : name.endsWith('.css') ? [path] : []
  })
}

describe('breakpoint ratchet', () => {
  it('every @media width is on the scale of app/ds/tokens.css', () => {
    const off: string[] = []
    for (const f of [...cssFiles('app'), ...cssFiles('components')]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(WIDTH)) if (!SCALE.has(Number(m[1]))) off.push(`${f}:${i + 1} (${m[1]}px)`)
      })
    }
    expect(off).toEqual([])
  })
})
