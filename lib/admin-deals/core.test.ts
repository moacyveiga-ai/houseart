import { describe, expect, it } from 'vitest'
import { canMarkPaid, dealKpis, escrowOf, filterKey, matchesFilter, type AdminDealRow, type AdminSplitLine } from './core'

const line = (p: Partial<AdminSplitLine>): AdminSplitLine => ({ id: 1, party: 'ARTIST', label: 'Artista', amountCents: '1000', status: 'HELD', payoutState: 'HELD', payoutLabel: '', payoutError: null, payee: 'Joana', ...p })
const row = (p: Partial<AdminDealRow>): AdminDealRow => ({ id: 1, code: 'DL-1', phase: 'ESCROW', phaseLabel: 'x', exception: null, artworkTitle: 'Obra', artworkId: 1, artist: 'Joana', seller: 'Joana', sellerKind: 'ARTIST', buyer: 'Lia', market: 'PRIMARY', amountCents: '1000', totalCents: '1200', escrow: { state: 'PAID', label: '' }, splits: [], createdAt: '2026-10-01T12:00:00Z', completedAt: null, ...p })

describe('admin deals core', () => {
  it('escrow label', () => {
    const fmt = (iso: string) => iso.slice(0, 10)
    expect(escrowOf({ escrowPaidAt: '2026-10-12', escrowMethod: 'PIX', escrowPendingRef: null, escrowExpiresAt: null }, fmt)).toEqual({ state: 'PAID', label: 'Pago em 2026-10-12 · Pix' })
    expect(escrowOf({ escrowPaidAt: null, escrowMethod: 'BOLETO', escrowPendingRef: 'pi_1', escrowExpiresAt: '2026-10-15' }, fmt)).toEqual({ state: 'PENDING', label: 'boleto aguardando · vence 2026-10-15' })
    expect(escrowOf({ escrowPaidAt: null, escrowMethod: null, escrowPendingRef: null, escrowExpiresAt: null }, fmt).state).toBe('UNPAID')
  })
  it('filters and kpis', () => {
    const rows = [
      row({ id: 1, phase: 'COMPLETED', splits: [line({ status: 'RELEASED', payoutState: 'MANUAL', amountCents: '500' }), line({ id: 2, party: 'PLATFORM', payoutState: 'PLATFORM', status: 'PAID' })] }),
      row({ id: 2, phase: 'COMPLETED', splits: [line({ status: 'RELEASED', payoutState: 'FAILED', payoutError: 'balance_insufficient' })] }),
      row({ id: 3, phase: 'DOCUMENTS', exception: 'DISPUTE', totalCents: '7000' }),
      row({ id: 4, phase: 'ESCROW', exception: 'CANCELLED' }),
      row({ id: 5, phase: 'OFFER_ACCEPTED', escrow: { state: 'PENDING', label: '' } }),
    ]
    const ids = (f: Parameters<typeof matchesFilter>[1]) => rows.filter((r) => matchesFilter(r, f)).map((r) => r.id)
    expect(ids('open')).toEqual([3, 5])
    expect(ids('escrow')).toEqual([5])
    expect(ids('payout')).toEqual([1, 2])
    expect(ids('failed')).toEqual([2])
    expect(ids('dispute')).toEqual([3])
    expect(ids('completed')).toEqual([1, 2])
    expect(ids('cancelled')).toEqual([4])
    expect(ids('all')).toHaveLength(5)
    expect(dealKpis(rows)).toEqual({ open: 2, escrowCents: 7000n, releasedCents: 1500n, releasedCount: 2, failed: 1, disputes: 1 })
    expect(filterKey('nope')).toBe('open')
  })
  it('what the desk may mark as paid', () => {
    expect(canMarkPaid({ status: 'RELEASED', payoutState: 'MANUAL' })).toBe(true)
    expect(canMarkPaid({ status: 'RELEASED', payoutState: 'FAILED' })).toBe(true)
    expect(canMarkPaid({ status: 'RELEASED', payoutState: 'PENDING' })).toBe(false)
    expect(canMarkPaid({ status: 'PAID', payoutState: 'STRIPE_PAID' })).toBe(false)
    expect(canMarkPaid({ status: 'HELD', payoutState: 'HELD' })).toBe(false)
  })
})
