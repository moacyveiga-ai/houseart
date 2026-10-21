import { describe, expect, it } from 'vitest'
import { royaltyFor } from './core'

describe('royaltyFor', () => {
  it('5 % of the appreciation; nothing without appreciation (design: R$ 5.500 → R$ 275)', () => {
    expect(royaltyFor(5_200_000n, 4_650_000n)).toEqual({ appreciationCents: 550_000n, royaltyCents: 27_500n })
    expect(royaltyFor(4_000_000n, 4_650_000n)).toEqual({ appreciationCents: 0n, royaltyCents: 0n })
  })
})
