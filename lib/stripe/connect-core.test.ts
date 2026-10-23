import { describe, expect, it } from 'vitest'
import { canReceiveTransfers, connectStatusOf, payeeMemberOf, payoutErrorOf, requirementCodesOf, requirementLabels, splitPayoutState, transferAmountOf, transferIdempotencyKey, type AccountSnapshot } from './connect-core'

const base: AccountSnapshot = { details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [], past_due: [], disabled_reason: null }, transfersCapability: 'active' }

describe('connectStatusOf', () => {
  it('ENABLED when submitted, transfers active and nothing due', () => {
    expect(connectStatusOf(base)).toBe('ENABLED')
  })
  it('ONBOARDING before the form is submitted, whatever the flags', () => {
    expect(connectStatusOf({ ...base, details_submitted: false, requirements: { currently_due: ['external_account'], past_due: [], disabled_reason: 'requirements.past_due' } })).toBe('ONBOARDING')
  })
  it('RESTRICTED when something is due, pending verification or the capability is not active', () => {
    expect(connectStatusOf({ ...base, requirements: { ...base.requirements, currently_due: ['individual.verification.document'] } })).toBe('RESTRICTED')
    expect(connectStatusOf({ ...base, requirements: { ...base.requirements, disabled_reason: 'requirements.pending_verification' } })).toBe('RESTRICTED')
    expect(connectStatusOf({ ...base, transfersCapability: 'pending' })).toBe('RESTRICTED')
    expect(connectStatusOf({ ...base, requirements: { ...base.requirements, past_due: ['external_account'] } })).toBe('RESTRICTED')
  })
  it('DISABLED on a rejection, a listing or a platform pause — never comes back by itself', () => {
    for (const r of ['rejected.fraud', 'rejected.terms_of_service', 'listed', 'platform_paused', 'other']) expect(connectStatusOf({ ...base, requirements: { ...base.requirements, disabled_reason: r } })).toBe('DISABLED')
  })
  it('without the capability field, charges + payouts flags decide', () => {
    expect(canReceiveTransfers({ ...base, transfersCapability: null })).toBe(true)
    expect(canReceiveTransfers({ ...base, transfersCapability: null, payouts_enabled: false })).toBe(false)
    expect(canReceiveTransfers({ ...base, transfersCapability: 'inactive' })).toBe(false)
  })
})

describe('requirements', () => {
  it('labels the common codes in pt-BR, collapses duplicates and keeps unknown codes readable', () => {
    expect(requirementLabels(['individual.dob.day', 'individual.dob.month', 'external_account', 'person_abc123.verification.document', 'weird.code'])).toEqual(['Data de nascimento', 'Conta bancária para receber', 'Documento do representante', 'weird.code'])
  })
  it('keeps only strings, bounded', () => {
    expect(requirementCodesOf(['a', 1, null, 'b'])).toEqual(['a', 'b'])
    expect(requirementCodesOf('x')).toEqual([])
    expect(requirementCodesOf(Array.from({ length: 80 }, (_, i) => `c${i}`)).length).toBe(60)
  })
})

describe('payee of a split line', () => {
  const artistSale = { sellerMemberId: 10, sellerKind: 'ARTIST', artistMemberId: 10 }
  const gallerySale = { sellerMemberId: 20, sellerKind: 'GALLERY_STAFF', artistMemberId: 30 }
  const galleryUnknownArtist = { sellerMemberId: 20, sellerKind: 'GALLERY_STAFF', artistMemberId: null }
  const collectorResale = { sellerMemberId: 40, sellerKind: 'COLLECTOR', artistMemberId: 30 }
  it('the seller share goes to the seller member; the artist of a gallery sale to the artist member; royalty to the artist', () => {
    expect(payeeMemberOf('ARTIST', artistSale)).toBe(10)
    expect(payeeMemberOf('GALLERY', gallerySale)).toBe(20)
    expect(payeeMemberOf('ARTIST', gallerySale)).toBe(30)
    expect(payeeMemberOf('ARTIST', galleryUnknownArtist)).toBeNull()
    expect(payeeMemberOf('GALLERY', collectorResale)).toBe(40)
    expect(payeeMemberOf('ARTIST_ROYALTY', collectorResale)).toBe(30)
  })
  it('the platform, shipping, insurance and the advisor (no member on the deal) go to nobody', () => {
    for (const p of ['PLATFORM', 'SHIPPING', 'INSURANCE', 'ADVISOR', 'x']) expect(payeeMemberOf(p, gallerySale)).toBeNull()
  })
})

describe('transfer', () => {
  it('one idempotency key per split line; the amount is integer cents within the Stripe limit', () => {
    expect(transferIdempotencyKey(42)).toBe('deal-split:42')
    expect(transferIdempotencyKey(42, 2)).toBe('deal-split:42:r2')
    expect(transferAmountOf(387_200n)).toBe(387_200)
    expect(transferAmountOf(0n)).toBeNull()
    expect(transferAmountOf(100_000_000n)).toBeNull()
  })
  it('the stored error is the code (or type, or name), never the message', () => {
    expect(payoutErrorOf({ type: 'StripeInvalidRequestError', code: 'balance_insufficient', message: 'secret 123' })).toBe('balance_insufficient')
    expect(payoutErrorOf({ type: 'StripeConnectionError', message: 'x' })).toBe('StripeConnectionError')
    expect(payoutErrorOf(new RangeError('boom'))).toBe('RangeError')
    expect(payoutErrorOf(null)).toBe('unknown')
  })
})

describe('splitPayoutState', () => {
  it('reads the row and the payee account', () => {
    expect(splitPayoutState({ party: 'PLATFORM', status: 'RELEASED', payoutError: null }, 'ENABLED')).toBe('PLATFORM')
    expect(splitPayoutState({ party: 'ARTIST', status: 'HELD', payoutError: null }, 'ENABLED')).toBe('HELD')
    expect(splitPayoutState({ party: 'ARTIST', status: 'PAID', payoutError: null }, null)).toBe('STRIPE_PAID')
    expect(splitPayoutState({ party: 'ARTIST', status: 'RELEASED', payoutError: 'balance_insufficient' }, 'ENABLED')).toBe('FAILED')
    expect(splitPayoutState({ party: 'ARTIST', status: 'RELEASED', payoutError: null }, 'ENABLED')).toBe('PENDING')
    expect(splitPayoutState({ party: 'ARTIST', status: 'RELEASED', payoutError: null }, 'ONBOARDING')).toBe('AWAITING_ACCOUNT')
    expect(splitPayoutState({ party: 'ARTIST', status: 'RELEASED', payoutError: null }, 'DISABLED')).toBe('MANUAL')
    expect(splitPayoutState({ party: 'GALLERY', status: 'RELEASED', payoutError: null }, null)).toBe('MANUAL')
  })
})
