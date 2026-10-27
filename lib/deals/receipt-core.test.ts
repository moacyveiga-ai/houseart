import { describe, expect, it } from 'vitest'
import { hasReceipt, receiptOf, type ReceiptInput } from './receipt-core'

const base: ReceiptInput = {
  side: 'BUYER', code: 'DL-2026-000001', artworkTitle: 'Voo baixo, 2024', artist: 'Joana Lima', sellerName: 'Galeria Tal', buyerName: 'Lia Souza',
  market: 'PRIMARY', completedAt: '2026-10-20T15:00:00.000Z', amountCents: 4_400_000n, shippingCents: 85_000n, insuranceCents: 0n, chargedCents: 4_485_000n,
  finance: [{ label: 'Valor da venda', cents: 4_400_000n, sign: '', strong: true }, { label: 'Comissão HouseArt · 12%', cents: 528_000n, sign: '−', strong: false }, { label: 'Galeria recebe', cents: 1_936_000n, sign: '', strong: true }],
}

describe('deal receipt', () => {
  it('exists only for a completed deal without exception', () => {
    expect(hasReceipt('COMPLETED', null)).toBe(true)
    expect(hasReceipt('SHIPPING', null)).toBe(false)
    expect(hasReceipt('COMPLETED', 'DISPUTE')).toBe(false)
  })
  it('the buyer sees what was paid, the seller as counterpart', () => {
    const r = receiptOf(base)
    expect(r.title).toBe('Comprovante de compra')
    expect(r.head.find((h) => h.label === 'Vendedor')?.value).toBe('Galeria Tal')
    expect(r.money.at(-1)).toMatchObject({ label: 'Total pago em garantia', strong: true })
    expect(r.money.at(-1)!.value).toContain('44.850')
    expect(r.money.find((m) => m.label === 'Seguro de transporte')?.value).toBe('—')
  })
  it('an offer hold captured only the price: the total is the price and the extras say so', () => {
    const r = receiptOf({ ...base, chargedCents: 4_400_000n })
    expect(r.money.at(-1)!.value).toContain('44.000')
    expect(r.money.find((m) => m.label === 'Frete')?.value).toContain('fora da garantia')
  })
  it('the seller sees the Financeiro lines with the deductions signed', () => {
    const r = receiptOf({ ...base, side: 'SELLER' })
    expect(r.title).toBe('Comprovante de venda')
    expect(r.head.find((h) => h.label === 'Comprador')?.value).toBe('Lia Souza')
    expect(r.money.map((m) => m.label)).toEqual(['Valor da venda', 'Comissão HouseArt · 12%', 'Galeria recebe'])
    expect(r.money[1]!.value.startsWith('− ')).toBe(true)
  })
})
