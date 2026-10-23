// The Stripe door — PURE decisions (no prisma, no next, no network). The I/O
// lives in door.ts (charges, holds, cards) and webhook-server.ts.
//
// Three modes, read from the env at the call:
//   mock — no key (or a key that does not match STRIPE_ENV): every charge is
//          paid on the spot with a `mock_` reference (dev, tests, smoke, and the
//          production of today with STRIPE_MOCK_ALLOWED=1);
//   test — STRIPE_ENV=test + an sk_test_ key: the real Stripe API in TEST mode
//          (cards 4242…, nothing is really charged);
//   live — STRIPE_ENV=live + an sk_live_ key.
// In the real production (VERCEL_ENV=production) mock needs STRIPE_MOCK_ALLOWED=1
// and test needs STRIPE_TEST_ALLOWED=1; otherwise every charge is refused (409).
import { createHmac, timingSafeEqual } from 'node:crypto'

export const STRIPE_MODES = ['mock', 'test', 'live'] as const
export type StripeMode = (typeof STRIPE_MODES)[number]

type EnvLike = Record<string, string | undefined>

export function stripeModeOf(env: EnvLike): StripeMode {
  const want = env.STRIPE_ENV?.trim()
  const key = (env.STRIPE_SECRET_KEY ?? '').trim()
  if (want === 'live' && key.startsWith('sk_live_')) return 'live'
  if (want === 'test' && key.startsWith('sk_test_')) return 'test'
  return 'mock'
}

/** The real production deployment (not a preview, not a local `next start`). */
export function isRealProduction(env: EnvLike): boolean {
  return env.NODE_ENV === 'production' && !!env.VERCEL && env.VERCEL_ENV === 'production'
}

/** Why charging is refused in this environment, or null. Live is never blocked here. */
export function blockedReason(env: EnvLike): 'MOCK_IN_PRODUCTION' | 'TEST_IN_PRODUCTION' | null {
  if (!isRealProduction(env)) return null
  const mode = stripeModeOf(env)
  if (mode === 'mock' && env.STRIPE_MOCK_ALLOWED !== '1') return 'MOCK_IN_PRODUCTION'
  if (mode === 'test' && env.STRIPE_TEST_ALLOWED !== '1') return 'TEST_IN_PRODUCTION'
  return null
}

export const BLOCKED_MESSAGES: Record<NonNullable<ReturnType<typeof blockedReason>>, string> = {
  MOCK_IN_PRODUCTION: 'Pagamento simulado bloqueado em produção.',
  TEST_IN_PRODUCTION: 'Pagamento de teste bloqueado em produção.',
}

/** The publishable key Stripe.js may load with: only when it matches the mode (pk_test_ ↔ test, pk_live_ ↔ live). */
export function publishableKeyOf(env: EnvLike): string | null {
  const mode = stripeModeOf(env)
  const pk = (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim()
  if (mode === 'test' && pk.startsWith('pk_test_')) return pk
  if (mode === 'live' && pk.startsWith('pk_live_')) return pk
  return null
}

// ── cards ──────────────────────────────────────────────────────────────────
const STRIPE_BRANDS: Record<string, 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard'> = { visa: 'visa', mastercard: 'mastercard', amex: 'amex', american_express: 'amex', elo: 'elo', hipercard: 'hipercard' }
/** Stripe's `card.brand` → our allowlist (CARD_BRANDS); anything else is 'other'. */
export function brandFromStripe(brand: string | null | undefined): 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard' | 'other' {
  return STRIPE_BRANDS[(brand ?? '').toLowerCase()] ?? 'other'
}

// ── charges ────────────────────────────────────────────────────────────────
export interface ChargeFailure { code: string; message: string; status: number }

/** A PaymentIntent that came back from `confirm` in a state other than the expected one. */
export function failureOfStatus(status: string, expected: 'succeeded' | 'requires_capture'): ChargeFailure | null {
  if (status === expected) return null
  if (status === 'requires_action') return { code: 'PAYMENT_ACTION_REQUIRED', message: 'O banco pediu uma confirmação extra para este cartão. Use outro cartão ou confirme a compra pelo app do banco e tente de novo.', status: 402 }
  if (status === 'requires_payment_method') return { code: 'CARD_DECLINED', message: 'O cartão foi recusado. Tente outro cartão.', status: 402 }
  if (status === 'processing') return { code: 'PAYMENT_PROCESSING', message: 'O pagamento ainda está em processamento. Aguarde alguns minutos e confira de novo.', status: 409 }
  return { code: 'PAYMENT_FAILED', message: 'Não foi possível concluir o pagamento.', status: 402 }
}

/** A Stripe error (StripeCardError and friends) → clean pt-BR, never the raw message. */
export function failureOfError(e: { type?: string; code?: string; decline_code?: string } | null | undefined): ChargeFailure {
  const code = e?.code ?? ''
  if (code === 'authentication_required') return { code: 'PAYMENT_ACTION_REQUIRED', message: 'O banco pediu uma confirmação extra para este cartão. Use outro cartão ou confirme a compra pelo app do banco e tente de novo.', status: 402 }
  if (code === 'expired_card') return { code: 'CARD_EXPIRED', message: 'O cartão está vencido. Cadastre outro cartão na carteira.', status: 402 }
  if (code === 'insufficient_funds' || e?.decline_code === 'insufficient_funds') return { code: 'INSUFFICIENT_FUNDS', message: 'O cartão não tem limite para este valor. Tente outro cartão.', status: 402 }
  if (code === 'incorrect_cvc' || code === 'invalid_cvc') return { code: 'CARD_DECLINED', message: 'O código de segurança do cartão não confere.', status: 402 }
  if (e?.type === 'StripeCardError' || code === 'card_declined') return { code: 'CARD_DECLINED', message: 'O cartão foi recusado. Tente outro cartão.', status: 402 }
  if (e?.type === 'StripeRateLimitError' || e?.type === 'StripeConnectionError' || e?.type === 'StripeAPIError') return { code: 'PAYMENT_UNAVAILABLE', message: 'O processador de pagamentos não respondeu. Tente de novo em instantes.', status: 503 }
  return { code: 'PAYMENT_FAILED', message: 'Não foi possível concluir o pagamento.', status: 502 }
}

export const NO_CARD: ChargeFailure = { code: 'NO_CARD', message: 'Cadastre um cartão na carteira para pagar.', status: 402 }

/**
 * What to do with the card hold of an offer when it is accepted: capture the
 * accepted amount when the hold covers it; a hold SMALLER than the accepted
 * amount (the buyer took a higher counter) is released and the deal asks the
 * escrow payment as usual — capturing part of it would mark the escrow paid short.
 */
export function holdSettlement(authorizedCents: bigint, acceptedCents: bigint): { action: 'capture'; amountCents: bigint } | { action: 'release' } {
  if (acceptedCents > 0n && acceptedCents <= authorizedCents) return { action: 'capture', amountCents: acceptedCents }
  return { action: 'release' }
}

/** Guarantee lifecycle on the offer (Offer.guaranteeStatus; null = mock or no hold). */
export const GUARANTEE_STATUSES = ['AUTHORIZED', 'CAPTURED', 'CANCELLED', 'FAILED'] as const
export type GuaranteeStatus = (typeof GUARANTEE_STATUSES)[number]
const TERMINAL: readonly GuaranteeStatus[] = ['CAPTURED', 'CANCELLED']

/** A mock reference never reaches Stripe. */
export function isStripeRef(ref: string | null | undefined): ref is string {
  return !!ref && ref.startsWith('pi_')
}

// ── webhook ────────────────────────────────────────────────────────────────
export const HANDLED_EVENTS = ['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'payment_intent.amount_capturable_updated'] as const
export type HandledEvent = (typeof HANDLED_EVENTS)[number]
export const isHandledEvent = (t: string): t is HandledEvent => (HANDLED_EVENTS as readonly string[]).includes(t)

/** The offer guarantee status an event leads to, from the current one (terminal states never move). */
export function nextGuaranteeStatus(current: string | null, event: HandledEvent): GuaranteeStatus | null {
  if (current && (TERMINAL as readonly string[]).includes(current)) return null
  const to: GuaranteeStatus = event === 'payment_intent.succeeded' ? 'CAPTURED' : event === 'payment_intent.canceled' ? 'CANCELLED' : event === 'payment_intent.payment_failed' ? 'FAILED' : 'AUTHORIZED'
  return to === current ? null : to
}

/** The order status an event leads to: only an OPEN order moves (a PAID one is never undone by a late event). */
export function nextOrderStatus(current: string, event: HandledEvent): 'PAID' | 'CANCELLED' | null {
  if (current !== 'OPEN') return null
  if (event === 'payment_intent.succeeded') return 'PAID'
  if (event === 'payment_intent.payment_failed' || event === 'payment_intent.canceled') return 'CANCELLED'
  return null
}

/**
 * Verifies the `Stripe-Signature` header (t=…,v1=…) over the RAW body, the
 * same scheme as stripe.webhooks.constructEvent: HMAC-SHA256 of `${t}.${body}`
 * with the endpoint secret, any v1 matching, timestamp within the tolerance.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300): boolean {
  if (!header || !secret) return false
  let t: number | null = null
  const sigs: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map((x) => x?.trim() ?? '')
    if (k === 't' && /^\d+$/.test(v)) t = Number(v)
    if (k === 'v1' && /^[0-9a-f]{64}$/i.test(v)) sigs.push(v.toLowerCase())
  }
  if (t === null || sigs.length === 0) return false
  if (Math.abs(nowSec - t) > toleranceSec) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex'), 'utf8')
  return sigs.some((s) => { const b = Buffer.from(s, 'utf8'); return b.length === expected.length && timingSafeEqual(b, expected) })
}

/** Builds a valid header (tests and the local CLI replay). */
export function signStripePayload(rawBody: string, secret: string, tSec: number): string {
  return `t=${tSec},v1=${createHmac('sha256', secret).update(`${tSec}.${rawBody}`, 'utf8').digest('hex')}`
}
