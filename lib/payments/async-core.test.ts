import { describe, expect, it } from 'vitest'
import { boletoBillingProblem, expiresAtFor, instructionsFromStripe, mockBoletoNumber, mockPixCode, parseInstructions } from './async-core'

describe('Pix e boleto (pure)', () => {
  it('deadlines', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    expect(expiresAtFor('PIX', now).toISOString()).toBe('2026-10-27T12:00:00.000Z')
    expect(expiresAtFor('BOLETO', now).toISOString()).toBe('2026-10-29T12:00:00.000Z')
  })
  it('reads the Stripe next_action', () => {
    const fb = new Date('2026-10-27T00:00:00Z')
    const pix = instructionsFromStripe('PIX', 1000n, { pix_display_qr_code: { data: '000201abc', image_url_png: 'https://q/x.png', expires_at: 1793100000, hosted_instructions_url: 'https://h' } }, fb)
    expect(pix).toMatchObject({ method: 'PIX', pixCode: '000201abc', pixQrUrl: 'https://q/x.png', hostedUrl: 'https://h', amountCents: '1000' })
    const bol = instructionsFromStripe('BOLETO', 1000n, { boleto_display_details: { number: '0019', pdf: 'https://p', hosted_voucher_url: null, expires_at: null } }, fb)
    expect(bol).toMatchObject({ boletoNumber: '0019', boletoPdfUrl: 'https://p', expiresAt: fb.toISOString() })
    expect(instructionsFromStripe('PIX', 1000n, {}, fb)).toBeNull()
  })
  it('boleto billing', () => {
    const ok = { taxId: '123.456.789-09', line1: 'Rua A, 10', city: 'Salvador', state: 'ba', postalCode: '40000-000' }
    expect(boletoBillingProblem(ok)).toBeNull()
    expect(boletoBillingProblem({ ...ok, taxId: '1' })).toMatch(/CPF/)
    expect(boletoBillingProblem({ ...ok, state: 'XX' })).toMatch(/UF/)
  })
  it('mock codes are stable and shaped', () => {
    expect(mockPixCode('DL-2026-000003', 750000n)).toBe(mockPixCode('DL-2026-000003', 750000n))
    expect(mockPixCode('DL-2026-000003', 750000n)).toContain('5407' + '7500.00')
    expect(mockBoletoNumber(3, 750000n).replace(/\D/g, '')).toHaveLength(47)
    expect(parseInstructions('{"method":"PIX","amountCents":"1","expiresAt":"x"}')?.method).toBe('PIX')
    expect(parseInstructions('{bad')).toBeNull()
  })
})
