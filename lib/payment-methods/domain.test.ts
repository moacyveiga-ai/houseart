import { describe, expect, it } from 'vitest'
import { brandOf, checkCard, checkPixKey, luhn, toPaymentMethodView } from './domain'

const now = new Date('2026-10-22T12:00:00Z')
describe('cards', () => {
  it('luhn and brands', () => {
    expect(luhn('4242424242424242')).toBe(true)
    expect(luhn('4242424242424241')).toBe(false)
    expect(brandOf('4242424242424242')).toBe('visa')
    expect(brandOf('5555555555554444')).toBe('mastercard')
    expect(brandOf('378282246310005')).toBe('amex')
    expect(brandOf('6062825624254001')).toBe('hipercard')
  })
  it('checks the six rules in the prototype order', () => {
    const base = { number: '4242 4242 4242 4242', exp: '11/28', cvc: '123', holder: 'Marina Lopes', cep: '40140-180' }
    expect(checkCard(base, now)).toMatchObject({ ok: true, brand: 'visa', last4: '4242', expMonth: 11, expYear: 2028, holder: 'MARINA LOPES', cep: '40140180' })
    expect(checkCard({ ...base, number: '1234' }, now)).toMatchObject({ ok: false, error: 'O número do cartão é inválido.' })
    expect(checkCard({ ...base, exp: '09/26' }, now)).toMatchObject({ ok: false })
    expect(checkCard({ ...base, exp: '10/26' }, now)).toMatchObject({ ok: true })
    expect(checkCard({ ...base, number: '378282246310005', cvc: '123' }, now)).toMatchObject({ ok: false, error: 'O código de segurança está incompleto.' })
    expect(checkCard({ ...base, holder: ' ' }, now)).toMatchObject({ ok: false, error: 'Informe o nome impresso no cartão.' })
    expect(checkCard({ ...base, cep: '4014' }, now)).toMatchObject({ ok: false, error: 'O CEP está incompleto.' })
  })
  it('view never carries the token', () => {
    const v = toPaymentMethodView({ id: 1, brand: 'visa', last4: '4821', holderName: 'M', expMonth: 3, expYear: 2029, isDefault: true })
    expect(v).toEqual({ id: 1, brand: 'visa', brandLabel: 'Visa', last4: '4821', holderName: 'M', exp: '03/29', isDefault: true, label: 'Visa •••• 4821' })
  })
})
describe('pix keys', () => {
  it('CPF must be the holder', () => {
    expect(checkPixKey('CPF', '071.482.913-55', '07148291355')).toMatchObject({ ok: true, key: '07148291355', mask: '***.482.913-**' })
    expect(checkPixKey('CPF', '00000000191', '07148291355')).toMatchObject({ ok: false })
    expect(checkPixKey('CPF', '123', null)).toMatchObject({ ok: false })
  })
  it('e-mail, phone and random', () => {
    expect(checkPixKey('EMAIL', 'Ana@Exemplo.com', null)).toMatchObject({ ok: true, key: 'ana@exemplo.com', mask: 'an***@exemplo.com' })
    expect(checkPixKey('PHONE', '(71) 99876-2210', null)).toMatchObject({ ok: true, key: '+5571998762210', mask: '(71) 9****-2210' })
    expect(checkPixKey('RANDOM', '123e4567-e89b-12d3-a456-426614174000', null)).toMatchObject({ ok: true })
    expect(checkPixKey('RANDOM', 'abc', null)).toMatchObject({ ok: false })
    expect(checkPixKey('X', 'abc', null)).toMatchObject({ ok: false })
  })
})

describe('cpfMaskOf', async () => {
  const { cpfMaskOf } = await import('./domain')
  it('masks the middle digits only, null without a CPF', () => {
    expect(cpfMaskOf('123.456.789-09')).toBe('***.456.789-**')
    expect(cpfMaskOf(null)).toBeNull()
    expect(cpfMaskOf('12345')).toBeNull()
  })
})
