import { describe, expect, it } from 'vitest'
import { artworkPatchSchema } from './input'

describe('artworkPatchSchema', () => {
  it('converts cm to mm and BRL text to cents', () => {
    const r = artworkPatchSchema.parse({ heightMm: '90', depthMm: '3,5', listPriceCents: 'R$ 21.000,00', year: '2026' })
    expect(r).toMatchObject({ heightMm: 900, depthMm: 35, listPriceCents: 2_100_000, year: 2026 })
  })
  it('takes the "Sobre a obra" text up to 2000 characters', () => {
    expect(artworkPatchSchema.parse({ description: '  Óleo pintado na praia.  ' }).description).toBe('Óleo pintado na praia.')
    expect(artworkPatchSchema.safeParse({ description: 'x'.repeat(2001) }).success).toBe(false)
  })
  it('refuses unknown keys and bad regions', () => {
    expect(() => artworkPatchSchema.parse({ memberId: 9 })).toThrow()
    expect(() => artworkPatchSchema.parse({ conditionRegions: [{ region: 'LEFT', state: 'INTACT' }] })).toThrow()
  })
})
