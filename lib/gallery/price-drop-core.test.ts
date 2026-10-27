import { describe, expect, it } from 'vitest'
import { PRICE_DROP_MAX_RECIPIENTS, priceDropNotice, priceDropRecipients } from './price-drop-core'

describe('price drop notice', () => {
  it('each saver once, never the actor, capped', () => {
    expect(priceDropRecipients([3, 7, 3, 9, 7], 9)).toEqual([3, 7])
    expect(priceDropRecipients([], 1)).toEqual([])
    const many = Array.from({ length: PRICE_DROP_MAX_RECIPIENTS + 20 }, (_, i) => i + 10)
    expect(priceDropRecipients(many, 1)).toHaveLength(PRICE_DROP_MAX_RECIPIENTS)
  })
  it('the notice names the work and both prices', () => {
    const n = priceDropNotice({ title: 'Construção nº 7', publicId: 'HA-7' }, 3_800_000n, 3_400_000n)
    expect(n.title).toBe('Obra que você salvou baixou de preço')
    expect(n.body).toMatch(/^Construção nº 7 · de R\$\s38\.000 por R\$\s34\.000$/)
    expect(n.href).toBe('/e/artwork/HA-7')
  })
})
