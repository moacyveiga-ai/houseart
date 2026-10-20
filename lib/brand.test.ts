// The brand on screen is HouseArt. Nothing visible says "Housebroker" or
// "Housemap", and the art vocabulary rules: the real-estate words of the
// origin repo never reach app/, components/ or lib/ (Prompt 2 rule).
import { describe, expect, it } from 'vitest'
import { read, sourceFiles } from './architecture/source-graph'

const FORBIDDEN = [/Housebroker/i, /Housemap/i, /\bim[oó]ve(l|is)\b/i, /\bcorretor(a|es|as)?\b/i, /\bimobili[aá]ria(s)?\b/i]
const files = [...sourceFiles('app', 'components', 'lib'), 'middleware.ts', 'instrumentation.ts']
  .filter((f) => !f.startsWith('app/generated/'))

// Comments may cite the origin ("ported from the Housebroker lib/escopo"): that is
// provenance, not product text. Only CODE and visible strings are checked.
const noComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')

describe('brand and vocabulary ratchet', () => {
  it('no origin-repo brand or real-estate word in app/, components/ or lib/', () => {
    const hits: string[] = []
    for (const f of files) {
      noComments(read(f)).split('\n').forEach((line, i) => {
        for (const re of FORBIDDEN) if (re.test(line)) hits.push(`${f}:${i + 1} ${re}`)
      })
    }
    expect(hits).toEqual([])
  })
})
