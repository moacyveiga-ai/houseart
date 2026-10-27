import { describe, expect, it } from 'vitest'
import { purchaseDone, purchasePct, purchaseSteps } from './purchase-progress-core'

const steps = [
  { phase: 'OFFER_ACCEPTED' as const, date: '01/10' },
  { phase: 'ESCROW' as const, date: '02/10' },
  { phase: 'DOCUMENTS' as const, date: '03/10' },
  { phase: 'SHIPPING' as const, date: '04/10' },
  { phase: 'DELIVERY' as const, date: null },
  { phase: 'TRANSFER' as const, date: null },
]

describe('purchase progress', () => {
  it('maps the six phases to the five buyer steps', () => {
    expect(purchaseDone('OFFER_ACCEPTED')).toBe(0)
    expect(purchaseDone('DOCUMENTS')).toBe(1)
    expect(purchaseDone('SHIPPING')).toBe(2)
    expect(purchaseDone('DELIVERY')).toBe(4)
    expect(purchasePct('COMPLETED')).toBe(100)
    expect(purchasePct('OFFER_ACCEPTED')).toBe(0)
  })
  it('dates done steps and marks the current one', () => {
    const s = purchaseSteps({ phase: 'SHIPPING', steps, shipping: { carrier: 'ArtLog', tracking: 'AL123' } })
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'on', 'todo', 'todo'])
    expect(s[0]!.date).toBe('02/10')
    expect(s[1]!.date).toBe('04/10')
    expect(s[2]!.description).toBe('ArtLog · rastreio AL123')
    expect(s[2]!.date).toBeNull()
  })
  it('completed: all done', () => {
    const s = purchaseSteps({ phase: 'COMPLETED', steps: [...steps.slice(0, 4), { phase: 'DELIVERY', date: '05/10' }, { phase: 'TRANSFER', date: '05/10' }], shipping: null })
    expect(s.every((x) => x.state === 'done')).toBe(true)
    expect(s[4]!.date).toBe('05/10')
  })
  it('cancelled: no step highlighted', () => {
    const s = purchaseSteps({ phase: 'OFFER_ACCEPTED', exception: 'CANCELLED', steps, shipping: null })
    expect(s.every((x) => x.state === 'todo')).toBe(true)
  })
})
