import { describe, expect, it } from 'vitest'
import { addressLine, checkAddress } from './core'

const ok = { recipient: 'Marina', cep: '41950-000', street: 'Rua da Paciência', number: '120', district: 'Rio Vermelho', city: 'Salvador', uf: 'ba' }

describe('addresses core', () => {
  it('checks the form and normalizes CEP and UF', () => {
    const r = checkAddress(ok)
    expect(r).toMatchObject({ ok: true, value: { cep: '41950000', uf: 'BA', label: 'Casa', complement: null, isDefault: false } })
    expect(checkAddress({ ...ok, cep: '123' })).toMatchObject({ ok: false })
    expect(checkAddress({ ...ok, uf: 'XX' })).toMatchObject({ ok: false })
    expect(checkAddress({ ...ok, recipient: ' ' })).toMatchObject({ ok: false })
  })
  it('one-line label', () => {
    expect(addressLine({ street: 'Rua X', number: '120', complement: 'ap 31', district: 'Rio Vermelho', city: 'Salvador', uf: 'BA', cep: '41950000' })).toBe('Rua X, 120, ap 31 · Rio Vermelho, Salvador – BA · 41950-000')
  })
})
