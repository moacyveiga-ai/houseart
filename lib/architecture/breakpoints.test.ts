// Breakpoint ratchet (audit design-system "Breakpoints"): every @media width in the CSS is one of the
// scale documented at the top of app/ds/tokens.css — loose values (600, 640, 1100…) drift the layout.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCALE = new Set([480, 719, 720, 721, 900, 1023, 1024, 1200])
// any width/height condition, any unit, spaces anywhere, across lines; the range syntax too
const WIDTH = /\(\s*(?:max-|min-)?(?:width|height)\s*[:<>=]+\s*([\d.]+)\s*([a-z%]*)\s*\)/gi
const RANGE = /\(\s*[\d.]+\s*[a-z%]*\s*[<>]=?\s*(?:width|height)/gi

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
      const css = readFileSync(f, 'utf8')
      // only the preludes of @media / @container (a min-height of a box is not a breakpoint)
      for (const at of css.matchAll(/@(?:media|container)\b([^{]*)\{/gi)) {
        const prelude = at[1]
        const line = css.slice(0, at.index).split('\n').length
        if (RANGE.test(prelude)) off.push(`${f}:${line} (range syntax)`)
        RANGE.lastIndex = 0
        for (const m of prelude.matchAll(WIDTH)) {
          const unit = (m[2] || 'px').toLowerCase()
          const isHeight = /height/i.test(m[0])
          if (unit !== 'px') off.push(`${f}:${line} (${m[1]}${unit}: use px)`)
          else if (!isHeight && !SCALE.has(Number(m[1]))) off.push(`${f}:${line} (${m[1]}px)`)
        }
      }
    }
    expect(off).toEqual([])
  })
})
