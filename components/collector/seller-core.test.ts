import { describe, expect, it } from 'vitest'
import { autoAcceptBps, digitsOf, formatThousands, orderServices, reaisDigitsToCents, sellEstimate, servicePriceLabel } from './seller-core'

const brl = (c: bigint) => `R$ ${Number(c / 100n)}`

describe('seller-core', () => {
  it('masks reais without cents and converts to cents', () => {
    expect(formatThousands('12500')).toBe('12.500')
    expect(formatThousands('R$ 1.200.000')).toBe('1.200.000')
    expect(formatThousands('007')).toBe('7')
    expect(formatThousands('')).toBe('')
    expect(reaisDigitsToCents('12.500')).toBe(1_250_000n)
    expect(reaisDigitsToCents('')).toBe(0n)
    expect(digitsOf('abc')).toBe('')
  })
  it('estimates the secondary sale: 8 % buyer on top, 4 % seller, 5 % of the appreciation (design R$ 5.500 → R$ 275)', () => {
    const e = sellEstimate(5_200_000n, 4_650_000n)
    expect(e.buyerFeeCents).toBe(416_000n)
    expect(e.buyerPaysCents).toBe(5_616_000n)
    expect(e.sellerFeeCents).toBe(208_000n)
    expect(e.royaltyCents).toBe(27_500n)
    expect(e.netCents).toBe(5_200_000n - 208_000n - 27_500n)
    expect(sellEstimate(4_000_000n, 4_650_000n).royaltyCents).toBe(0n)
    expect(sellEstimate(4_000_000n, null)).toMatchObject({ royaltyCents: 0n, appreciationCents: 0n, netCents: 3_840_000n })
    expect(sellEstimate(-5n, null).listCents).toBe(0n)
  })
  it('auto-accept minimum clamps to 50–100 %', () => {
    expect(autoAcceptBps('92')).toBe(9200)
    expect(autoAcceptBps('10')).toBe(5000)
    expect(autoAcceptBps('150')).toBe(10000)
    expect(autoAcceptBps('')).toBe(10000)
  })
  it('services: certification first; quotes read "Sob orçamento"', () => {
    expect(orderServices([{ code: 'SHIPPING' }, { code: 'CERTIFICATION' }, { code: 'APPRAISAL_SIGNED' }]).map((s) => s.code)).toEqual(['CERTIFICATION', 'SHIPPING', 'APPRAISAL_SIGNED'])
    expect(servicePriceLabel({ priceCents: '0', unit: 'QUOTE' }, brl)).toBe('Sob orçamento')
    expect(servicePriceLabel({ priceCents: '14900', unit: 'UNIT' }, brl)).toBe('R$ 149')
    expect(servicePriceLabel({ priceCents: '9900', unit: 'WEEK' }, brl)).toBe('R$ 99/semana')
  })
})
