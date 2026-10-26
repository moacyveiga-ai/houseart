import { describe, expect, it } from 'vitest'
import { balanceNotes, escrowChargedCents, walletBalances, walletMovements, type PurchaseFact, type SaleLineFact } from './ledger-core'

const d = (s: string) => new Date(s)
const purchase = (p: Partial<PurchaseFact>): PurchaseFact => ({ id: 1, code: 'DL-1', title: 'Obra', totalCents: 100_00n, paidAt: d('2026-10-01'), completedAt: null, cancelled: false, ...p })
const line = (l: Partial<SaleLineFact>): SaleLineFact => ({ id: 1, dealId: 1, dealCode: 'DL-9', title: 'Venda', amountCents: 50_00n, status: 'HELD', buyerPaid: true, transferredAt: null, cancelled: false, ...l })

describe('wallet ledger', () => {
  it('em garantia: paid and not completed nor cancelled', () => {
    const b = walletBalances([purchase({}), purchase({ id: 2, completedAt: d('2026-10-02') }), purchase({ id: 3, cancelled: true }), purchase({ id: 4, paidAt: null })], [])
    expect(b.inEscrowCents).toBe(100_00n)
    expect(b.inEscrowCount).toBe(1)
  })
  it('a receber: held or released lines of paid deals, counted per deal', () => {
    const b = walletBalances([], [line({}), line({ id: 2, status: 'RELEASED' }), line({ id: 3, dealId: 2, status: 'PAID' }), line({ id: 4, dealId: 3, cancelled: true })])
    expect(b.receivableCents).toBe(100_00n)
    expect(b.receivableCount).toBe(1)
  })
  it('notes', () => {
    expect(balanceNotes({ inEscrowCents: 0n, inEscrowCount: 0, receivableCents: 0n, receivableCount: 0 })).toEqual({ escrow: 'nenhuma compra em curso', receivable: 'nenhuma venda em curso' })
    expect(balanceNotes({ inEscrowCents: 1n, inEscrowCount: 2, receivableCents: 1n, receivableCount: 1 })).toEqual({ escrow: '2 compras em curso', receivable: '1 venda a receber' })
  })
  it('movements: completed purchases, released holds and paid sales, newest first', () => {
    const m = walletMovements(
      [purchase({ completedAt: d('2026-10-03') }), purchase({ id: 2 })],
      [{ id: 7, code: 'OFR-7', title: 'Oferta', amountCents: 80_00n, at: d('2026-10-02') }],
      [line({ status: 'PAID', transferredAt: d('2026-10-04') }), line({ id: 2, status: 'RELEASED' })],
    )
    expect(m.map((x) => x.kind)).toEqual(['SALE_PAID', 'PURCHASE', 'HOLD_RELEASED'])
    expect(m[0]!.amount.startsWith('+ ')).toBe(true)
    expect(m[1]!.amount.startsWith('− ')).toBe(true)
    expect(m[1]!.sub).toBe('Compra concluída · DL-1')
  })
  it('escrow charged: the captured offer hold is only the price', () => {
    const base = { amountCents: 100n, shippingCents: 10n, insuranceCents: 5n }
    expect(escrowChargedCents({ ...base, escrowPaymentRef: 'pi_1:captured', offerHoldRef: 'pi_1' })).toBe(100n)
    expect(escrowChargedCents({ ...base, escrowPaymentRef: 'pi_2', offerHoldRef: 'pi_1' })).toBe(115n)
    expect(escrowChargedCents({ ...base, escrowPaymentRef: 'pi_2', offerHoldRef: null })).toBe(115n)
  })
})
