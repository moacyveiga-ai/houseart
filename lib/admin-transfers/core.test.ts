import { describe, expect, it } from 'vitest'
import { canCancel, canResend, isStuck, kpisOf, matchesFilter, stepStartOf, waitingFor } from './core'

const now = new Date('2026-10-26T15:00:00Z')
const t = (p: Partial<{ status: string; kycStatus: string | null; sellerSignedAt: string | null; buyerSignedAt: string | null; feePaidAt: string | null; createdAt: string }> = {}) => ({ status: 'INVITED', kycStatus: null, sellerSignedAt: null, buyerSignedAt: null, feePaidAt: null, createdAt: '2026-10-25T15:00:00Z', ...p })

describe('admin transfers core', () => {
  it('says what each transfer waits for', () => {
    expect(waitingFor(t())).toBe('BUYER_ACCEPT')
    expect(waitingFor(t({ status: 'SELLER_SIGNED', sellerSignedAt: 'x' }))).toBe('BUYER_SIGNATURE')
    expect(waitingFor(t({ status: 'BUYER_SIGNED', buyerSignedAt: 'x' }))).toBe('SELLER_SIGNATURE')
    expect(waitingFor(t({ status: 'KYC_PENDING', kycStatus: 'PENDING' }))).toBe('KYC')
    expect(waitingFor(t({ status: 'KYC_PENDING', kycStatus: 'REJECTED' }))).toBe('KYC_REJECTED')
    // approved by the desk, the buyer still has to sign on the next visit
    expect(waitingFor(t({ status: 'KYC_PENDING', kycStatus: 'APPROVED' }))).toBe('BUYER_ACCEPT')
    expect(waitingFor(t({ status: 'SIGNED', sellerSignedAt: 'x', buyerSignedAt: 'x' }))).toBe('FEE')
    expect(waitingFor(t({ status: 'AWAITING_TAP', feePaidAt: 'x' }))).toBe('TAP')
    expect(waitingFor(t({ status: 'COMPLETED' }))).toBe('DONE')
    expect(waitingFor(t({ status: 'CANCELLED' }))).toBe('CANCELLED')
  })
  it('a transfer parked for more than a week is stuck; a closed one never', () => {
    expect(isStuck(t(), now)).toBe(false)
    expect(isStuck(t({ createdAt: '2026-10-10T15:00:00Z' }), now)).toBe(true)
    // the step clock restarts at each step stamp, not at any write
    expect(isStuck(t({ status: 'SELLER_SIGNED', createdAt: '2026-10-10T15:00:00Z', sellerSignedAt: '2026-10-24T15:00:00Z' }), now)).toBe(false)
    expect(stepStartOf(t({ createdAt: '2026-10-10T15:00:00Z', sellerSignedAt: '2026-10-24T15:00:00Z' })).toISOString()).toBe('2026-10-24T15:00:00.000Z')
    expect(isStuck(t({ status: 'COMPLETED', createdAt: '2026-10-10T15:00:00Z' }), now)).toBe(false)
  })
  it('admin and manager resend while the buyer has not signed, and cancel any open one', () => {
    const adm = { profile: 'admin' }, op = { profile: 'finance' }
    expect(canResend(adm, t())).toBe(true)
    expect(canResend(adm, t({ status: 'BUYER_SIGNED', buyerSignedAt: 'x' }))).toBe(false)
    expect(canResend(adm, t({ status: 'KYC_PENDING', kycStatus: 'REJECTED' }))).toBe(false)
    expect(canResend(op, t())).toBe(false)
    expect(canCancel(adm, t({ status: 'AWAITING_TAP' }))).toBe(true)
    expect(canCancel(adm, t({ status: 'COMPLETED' }))).toBe(false)
  })
  it('filters and kpis', () => {
    const rows = [
      { status: 'INVITED', stuck: true, waiting: 'BUYER_ACCEPT' as const, feePaidAt: null },
      { status: 'KYC_PENDING', stuck: false, waiting: 'KYC' as const, feePaidAt: null },
      { status: 'AWAITING_TAP', stuck: false, waiting: 'TAP' as const, feePaidAt: 'x' },
      { status: 'COMPLETED', stuck: false, waiting: 'DONE' as const, feePaidAt: 'x' },
    ]
    expect(rows.filter((r) => matchesFilter(r, 'stuck')).length).toBe(1)
    expect(rows.filter((r) => matchesFilter(r, 'tap')).length).toBe(1)
    expect(kpisOf(rows)).toEqual({ open: 3, stuck: 1, kyc: 1, tap: 1, feePaidOpen: 1, completed: 1 })
  })
})
