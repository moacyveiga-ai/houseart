import { describe, expect, it } from 'vitest'
import { buyerTotalCents, computeSplit } from './split-core'

describe('deal split', () => {
  it('primary: 12 % platform, the rest to the artist (the design example: R$ 38.000 → HouseArt R$ 4.560)', () => {
    const s = computeSplit({ amountCents: 3_800_000n, market: 'PRIMARY', seller: 'ARTIST' })
    expect(s).toEqual([{ party: 'PLATFORM', bps: 1200, amountCents: 456_000n }, { party: 'ARTIST', bps: 8800, amountCents: 3_344_000n }])
  })
  it('primary via gallery with 46 % of the seller share', () => {
    const s = computeSplit({ amountCents: 3_800_000n, market: 'PRIMARY', seller: 'GALLERY', galleryBps: 4614 })
    expect(s.map((l) => l.party)).toEqual(['PLATFORM', 'GALLERY', 'ARTIST'])
    expect(s.reduce((a, l) => a + l.amountCents, 0n)).toBe(3_800_000n)
  })
  it('secondary: 4 % seller + royalty withheld; buyer pays 8 % on top', () => {
    const s = computeSplit({ amountCents: 5_200_000n, market: 'SECONDARY', seller: 'ARTIST', royaltyCents: 27_500n })
    expect(s.find((l) => l.party === 'PLATFORM')?.amountCents).toBe(208_000n)
    expect(s.find((l) => l.party === 'ARTIST_ROYALTY')?.amountCents).toBe(27_500n)
    expect(buyerTotalCents(5_200_000n, 'SECONDARY')).toBe(5_616_000n)
  })
})
