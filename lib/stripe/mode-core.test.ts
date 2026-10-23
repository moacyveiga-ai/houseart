import { describe, expect, it } from 'vitest'
import { blockedReason, brandFromStripe, failureOfError, failureOfStatus, holdSettlement, isStripeRef, nextGuaranteeStatus, nextOrderStatus, publishableKeyOf, signStripePayload, stripeModeOf, verifyStripeSignature } from './mode-core'

const PROD = { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' }

describe('stripe mode', () => {
  it('test and live only with the matching key; anything else is the mock', () => {
    expect(stripeModeOf({})).toBe('mock')
    expect(stripeModeOf({ STRIPE_ENV: 'test' })).toBe('mock')
    expect(stripeModeOf({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('test')
    expect(stripeModeOf({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_live_abc' })).toBe('mock')
    expect(stripeModeOf({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_live_abc' })).toBe('live')
    expect(stripeModeOf({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('mock')
    expect(stripeModeOf({ STRIPE_ENV: 'mock', STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('mock')
  })
  it('the real production refuses mock and test without their allow env; previews never block', () => {
    expect(blockedReason({})).toBeNull()
    expect(blockedReason({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview' })).toBeNull()
    expect(blockedReason(PROD)).toBe('MOCK_IN_PRODUCTION')
    expect(blockedReason({ ...PROD, STRIPE_MOCK_ALLOWED: '1' })).toBeNull()
    const test = { ...PROD, STRIPE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_x' }
    expect(blockedReason(test)).toBe('TEST_IN_PRODUCTION')
    expect(blockedReason({ ...test, STRIPE_MOCK_ALLOWED: '1' })).toBe('TEST_IN_PRODUCTION')
    expect(blockedReason({ ...test, STRIPE_TEST_ALLOWED: '1' })).toBeNull()
    expect(blockedReason({ ...PROD, STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_live_x' })).toBeNull()
  })
  it('the publishable key must match the mode', () => {
    expect(publishableKeyOf({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_1' })).toBeNull()
    expect(publishableKeyOf({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_1', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_1' })).toBe('pk_test_1')
    expect(publishableKeyOf({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_test_1', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_1' })).toBeNull()
    expect(publishableKeyOf({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_live_1', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_1' })).toBe('pk_live_1')
  })
})

describe('charges and holds', () => {
  it('maps PaymentIntent states and Stripe errors to clean pt-BR', () => {
    expect(failureOfStatus('succeeded', 'succeeded')).toBeNull()
    expect(failureOfStatus('requires_capture', 'requires_capture')).toBeNull()
    expect(failureOfStatus('requires_action', 'succeeded')).toMatchObject({ code: 'PAYMENT_ACTION_REQUIRED', status: 402 })
    expect(failureOfStatus('succeeded', 'requires_capture')).toMatchObject({ code: 'PAYMENT_FAILED' })
    expect(failureOfError({ type: 'StripeCardError', code: 'card_declined', decline_code: 'generic_decline' })).toMatchObject({ code: 'CARD_DECLINED', status: 402 })
    expect(failureOfError({ type: 'StripeCardError', code: 'card_declined', decline_code: 'insufficient_funds' })).toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    expect(failureOfError({ code: 'authentication_required' })).toMatchObject({ code: 'PAYMENT_ACTION_REQUIRED' })
    expect(failureOfError({ type: 'StripeConnectionError' })).toMatchObject({ status: 503 })
    expect(failureOfError(undefined).message).not.toMatch(/stripe/i)
  })
  it('captures the accepted amount within the hold, releases a hold smaller than it', () => {
    expect(holdSettlement(3_400_000n, 3_400_000n)).toEqual({ action: 'capture', amountCents: 3_400_000n })
    expect(holdSettlement(3_400_000n, 3_200_000n)).toEqual({ action: 'capture', amountCents: 3_200_000n })
    expect(holdSettlement(3_400_000n, 3_600_000n)).toEqual({ action: 'release' })
  })
  it('brands and refs', () => {
    expect(brandFromStripe('visa')).toBe('visa'); expect(brandFromStripe('amex')).toBe('amex'); expect(brandFromStripe('discover')).toBe('other'); expect(brandFromStripe(null)).toBe('other')
    expect(isStripeRef('pi_123')).toBe(true); expect(isStripeRef('mock_hold_1')).toBe(false); expect(isStripeRef(null)).toBe(false)
  })
})

describe('webhook', () => {
  const secret = 'whsec_test'
  const body = '{"id":"evt_1"}'
  it('verifies the signature over the raw body within the tolerance', () => {
    const h = signStripePayload(body, secret, 1_000)
    expect(verifyStripeSignature(body, h, secret, 1_000)).toBe(true)
    expect(verifyStripeSignature(body + ' ', h, secret, 1_000)).toBe(false)
    expect(verifyStripeSignature(body, h, 'whsec_other', 1_000)).toBe(false)
    expect(verifyStripeSignature(body, h, secret, 1_000 + 301)).toBe(false)
    expect(verifyStripeSignature(body, null, secret, 1_000)).toBe(false)
    expect(verifyStripeSignature(body, 't=1000', secret, 1_000)).toBe(false)
    expect(verifyStripeSignature(body, `${h},v1=${'0'.repeat(64)}`, secret, 1_000)).toBe(true)
  })
  it('guarantee and order statuses only move forward', () => {
    expect(nextGuaranteeStatus('AUTHORIZED', 'payment_intent.succeeded')).toBe('CAPTURED')
    expect(nextGuaranteeStatus('AUTHORIZED', 'payment_intent.canceled')).toBe('CANCELLED')
    expect(nextGuaranteeStatus('CAPTURED', 'payment_intent.canceled')).toBeNull()
    expect(nextGuaranteeStatus('CANCELLED', 'payment_intent.succeeded')).toBeNull()
    expect(nextGuaranteeStatus('AUTHORIZED', 'payment_intent.amount_capturable_updated')).toBeNull()
    expect(nextGuaranteeStatus('FAILED', 'payment_intent.succeeded')).toBe('CAPTURED')
    expect(nextOrderStatus('OPEN', 'payment_intent.succeeded')).toBe('PAID')
    expect(nextOrderStatus('PAID', 'payment_intent.payment_failed')).toBeNull()
    expect(nextOrderStatus('OPEN', 'payment_intent.canceled')).toBe('CANCELLED')
  })
})
