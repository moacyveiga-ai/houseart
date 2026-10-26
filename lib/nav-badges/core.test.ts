import { describe, expect, it } from 'vitest'
import { badgesFor, offerWaitsOnSeller } from './core'

const now = new Date('2026-10-26T15:00:00Z')
const later = new Date(now.getTime() + 3_600_000)

describe('nav badges core', () => {
  it('an offer waits on the seller when received, or negotiating with the buyer as the last to move; never when expired', () => {
    expect(offerWaitsOnSeller({ status: 'RECEIVED', expiresAt: later, lastAuthor: 'BUYER' }, now)).toBe(true)
    expect(offerWaitsOnSeller({ status: 'NEGOTIATING', expiresAt: later, lastAuthor: 'BUYER' }, now)).toBe(true)
    expect(offerWaitsOnSeller({ status: 'NEGOTIATING', expiresAt: later, lastAuthor: 'SELLER' }, now)).toBe(false)
    expect(offerWaitsOnSeller({ status: 'NEGOTIATING', expiresAt: later, lastAuthor: 'NEGOTIATOR' }, now)).toBe(false)
    expect(offerWaitsOnSeller({ status: 'RECEIVED', expiresAt: now, lastAuthor: 'BUYER' }, now)).toBe(false)
    expect(offerWaitsOnSeller({ status: 'ACCEPTED', expiresAt: later, lastAuthor: 'BUYER' }, now)).toBe(false)
  })
  it('each profile gets only the keys its menu has, and only non-zero', () => {
    const c = { certification: 2, sales: 3, wallet: 1, appraisals: 4, review: 6, kyc: 0, deals: 2, transfers: 1, messages: 5 }
    expect(badgesFor('artist', c)).toEqual({ certification: 2, sales: 3, messages: 5 })
    expect(badgesFor('gallery', c)).toEqual({ sales: 3, messages: 5 })
    expect(badgesFor('collector', c)).toEqual({ wallet: 1, messages: 5 })
    expect(badgesFor('appraiser', c)).toEqual({ appraisals: 4 })
    expect(badgesFor('admin', c)).toEqual({ review: 6, deals: 2, transfers: 1, appraisals: 4 })
    expect(badgesFor('artist', {})).toEqual({})
  })
})
