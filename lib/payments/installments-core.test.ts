import { describe, expect, it } from 'vitest'
import { clampInstallments, installmentNote, installmentOptions, installmentValue, validInstallments, CARD_CHARGE_MAX_CENTS } from './installments-core'

describe('parcelamento', () => {
  it('oferece 1, 3, 6 e 10× quando cada parcela passa de R$ 100', () => {
    expect(installmentOptions(3_878_400).map((o) => o.count)).toEqual([1, 3, 6, 10])
    expect(installmentOptions(3_878_400).at(-1)).toEqual({ count: 10, eachCents: 387_840 })
  })
  it('obra barata: só os planos com parcela de R$ 100 ou mais', () => {
    expect(installmentOptions(50_000).map((o) => o.count)).toEqual([1, 3])
    expect(installmentOptions(20_000).map((o) => o.count)).toEqual([1])
  })
  it('arredonda a parcela para cima', () => {
    expect(installmentValue(100_001, 3)).toBe(33_334)
  })
  it('confere o plano pedido', () => {
    expect(validInstallments(3_878_400, 10)).toBe(true)
    expect(validInstallments(50_000, 10)).toBe(false)
    expect(validInstallments(3_878_400, 4)).toBe(false)
    expect(validInstallments(3_878_400, 2.5)).toBe(false)
  })
  it('mantém a escolha possível quando o total muda', () => {
    expect(clampInstallments(50_000, 10)).toBe(3)
    expect(clampInstallments(3_878_400, 6)).toBe(6)
  })
})

describe('installmentNote', () => {
  it('stays silent while instalments are off', () => {
    expect(installmentNote(380_000, false)).toBeNull()
  })
  it('names the largest plan the checkout offers', () => {
    expect(installmentNote(380_000, true)).toBe('ou até 10× de R$ 380 sem juros no cartão')
    expect(installmentNote(50_000, true)).toBe('ou até 3× de R$ 167 sem juros no cartão')
  })
  it('never promises what one card payment cannot charge', () => {
    expect(installmentNote(CARD_CHARGE_MAX_CENTS + 1, true)).toBeNull()
    expect(installmentNote(1_500_000_000, true)).toBeNull()
    expect(installmentNote(null, true)).toBeNull()
    expect(installmentNote(15_000, true)).toBeNull()
  })
})
