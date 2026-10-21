// Leak ratchet: no public DTO, public route or marketplace projection carries
// the floor. Reads the source of the public surfaces and the offer DTOs.
import { describe, expect, it } from 'vitest'
import { read, sourceFiles } from '@/lib/architecture/source-graph'
import { SECRET_KEYS } from './mandate-core'

const PUBLIC_SURFACES = [...sourceFiles('app/api/public', 'app/api/v1', 'app/e', 'lib/marketplace', 'components/offers', 'components/marketplace')]
const DTO_FILES = ['lib/offers/dto.ts']

describe('the floor never leaves', () => {
  it('no secret key is mentioned in a public surface or in the offer DTOs', () => {
    const hits: string[] = []
    for (const f of [...PUBLIC_SURFACES, ...DTO_FILES]) {
      const code = read(f).replace(/\/\/[^\n]*/g, '')
      for (const k of SECRET_KEYS) if (new RegExp(`\\b${k}\\b`).test(code)) hits.push(`${f}: ${k}`)
    }
    expect(hits).toEqual([])
  })
})
