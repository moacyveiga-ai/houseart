import { describe, expect, it } from 'vitest'
import { blockedReason, checkoutTotals, initialAddressId, ctaLabel, insuranceText, maskCardNumber, maskCep, maskExpiry, previewCardNumber, summaryLines } from './checkout-core'

const brl = (c: number) => `R$ ${c / 100}`

describe('checkout core (pure)', () => {
  it('sums work + shipping + insurance with a carrier', () => {
    expect(checkoutTotals({ priceCents: 100_000, delivery: 'CARRIER', shippingCents: 4_800, insuranceCents: 800, insurance: true })).toEqual({ base: 100_000, shipping: 4_800, insurance: 800, total: 105_600 })
  })
  it('insurance off drops the line; pickup drops shipping and insurance', () => {
    expect(checkoutTotals({ priceCents: 100_000, delivery: 'CARRIER', shippingCents: 4_800, insuranceCents: 800, insurance: false }).total).toBe(104_800)
    expect(checkoutTotals({ priceCents: 100_000, delivery: 'PICKUP', shippingCents: 4_800, insuranceCents: 800, insurance: true })).toEqual({ base: 100_000, shipping: 0, insurance: 0, total: 100_000 })
  })
  it('summary lines say Grátis and — like the prototype', () => {
    const lines = summaryLines({ base: 100, shipping: 0, insurance: 0, total: 100 }, brl)
    expect(lines.map((l) => l.value)).toEqual(['R$ 1', 'Grátis', '—'])
    expect(summaryLines({ base: 100, shipping: 0, insurance: 0, total: 100 }, brl, true)[0].label).toBe('Obra · valor negociado')
  })
  it('insurance text follows delivery and toggle', () => {
    expect(insuranceText({ delivery: 'CARRIER', insurance: true, insuranceCents: 800, quoted: true }, brl)).toBe('Cobre transporte e os primeiros 30 dias · R$ 8')
    expect(insuranceText({ delivery: 'CARRIER', insurance: false, insuranceCents: 800, quoted: true }, brl)).toBe('Sem seguro, o risco do transporte é seu')
    expect(insuranceText({ delivery: 'PICKUP', insurance: true, insuranceCents: 800, quoted: true }, brl)).toMatch(/retirada/)
  })
  it('blocks without card, then without CEP for a carrier', () => {
    expect(blockedReason({ delivery: 'CARRIER', cepValid: false, hasCard: false })).toMatch(/cartão/)
    expect(blockedReason({ delivery: 'CARRIER', cepValid: false, hasCard: true })).toMatch(/CEP/)
    expect(blockedReason({ delivery: 'PICKUP', cepValid: false, hasCard: true })).toBeNull()
    expect(blockedReason({ delivery: 'CARRIER', cepValid: true, hasCard: true })).toBeNull()
  })
  it('cta label', () => {
    expect(ctaLabel({ hasCard: true, total: 100 }, brl)).toBe('Confirmar pedido · R$ 1')
    expect(ctaLabel({ hasCard: false, total: 100 }, brl)).toBe('Adicionar cartão para pagar')
  })
  it('masks', () => {
    expect(maskCardNumber('4111111111111111999', 'visa')).toBe('4111 1111 1111 1111')
    expect(maskCardNumber('378282246310005', 'amex')).toBe('3782 822463 10005')
    expect(maskExpiry('1229')).toBe('12/29')
    expect(maskCep('40140110')).toBe('40140-110')
    expect(previewCardNumber('4111 11', 'visa')).toBe('4111 11•• •••• ••••')
  })
})

describe('Pix e boleto no checkout', () => {
  const brl = (c: number) => `R$ ${c / 100}`
  it('Pix and boleto need no card; boleto needs its billing', () => {
    expect(blockedReason({ delivery: 'PICKUP', cepValid: false, hasCard: false, method: 'PIX' })).toBeNull()
    expect(blockedReason({ delivery: 'PICKUP', cepValid: false, hasCard: false, method: 'BOLETO', boletoProblem: 'Informe o CPF' })).toBe('Informe o CPF')
    expect(ctaLabel({ hasCard: false, total: 100, method: 'PIX' }, brl)).toBe('Pagar R$ 1 com Pix')
    expect(ctaLabel({ hasCard: false, total: 100, method: 'BOLETO' }, brl)).toBe('Pagar R$ 1 no boleto')
  })
})

describe('initialAddressId', () => {
  const a = (id: number, isDefault = false) => ({ id, label: 'Casa', line: 'Rua A, 1', cep: '40000000', isDefault })
  it('opens on the default address, else the first, else none', () => {
    expect(initialAddressId([a(1), a(2, true)])).toBe(2)
    expect(initialAddressId([a(3), a(4)])).toBe(3)
    expect(initialAddressId([])).toBeNull()
  })
})
