// The Stripe door (D.14) — the I/O. Decisions in mode-core.ts; the SDK only
// through gateway-server.ts (injectable in tests).
//   mock  → the charge is paid on the spot with a `mock_` reference (as before);
//   test  → STRIPE_ENV=test + sk_test_: real Stripe API in test mode;
//   live  → STRIPE_ENV=live + sk_live_.
// Cards: Stripe Customer per user + SetupIntent (the card is typed in Stripe
// Elements, never here); charges are PaymentIntents off_session with the
// payer's default card of the CURRENT mode, confirm=true, with an idempotency key.
// Connect payouts to sellers are out of this phase (docs/PRODUCAO-PENDENCIAS.md).
import 'server-only'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { ArtworkError } from '@/lib/artworks/server'
import { BLOCKED_MESSAGES, blockedReason, failureOfError, failureOfStatus, NO_CARD, publishableKeyOf, stripeModeOf, type ChargeFailure, type StripeMode } from './mode-core'
import { stripeGateway, type GwPaymentIntent, type GwPaymentMethod } from './gateway-server'

export type { StripeMode } from './mode-core'

export function stripeMode(env: NodeJS.ProcessEnv = process.env): StripeMode {
  return stripeModeOf(env)
}

/** Mock refused in production unless STRIPE_MOCK_ALLOWED=1 (previews, smoke). Kept for the callers of Phase 4. */
export function mockForbidden(env: NodeJS.ProcessEnv = process.env): boolean {
  return blockedReason(env) === 'MOCK_IN_PRODUCTION'
}

/** Throws 409 when this environment may not charge (mock or test in the real production without the allow env). */
export function assertChargeAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const r = blockedReason(env)
  if (r) throw new ArtworkError('STRIPE_BLOCKED', BLOCKED_MESSAGES[r], 409)
}

/** The publishable key the screens load Stripe.js with; null keeps the mock card form. */
export function stripePublishableKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return publishableKeyOf(env)
}

const fail = (f: ChargeFailure): ArtworkError => new ArtworkError(f.code, f.message, f.status)
function stripeFailure(e: unknown): ArtworkError {
  if (e instanceof ArtworkError) return e
  return fail(failureOfError(e as { type?: string; code?: string; decline_code?: string }))
}

// ── customer and cards ────────────────────────────────────────────────────
/** The Stripe Customer of the user in the current mode, created once (CAS on the column read). */
export async function ensureCustomer(userId: number): Promise<string> {
  const mode = stripeMode()
  if (mode === 'mock') throw new ArtworkError('STRIPE_MOCK', 'Cartões reais não estão ligados.', 409)
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, stripeCustomerId: true, stripeCustomerMode: true } })
  if (!u) throw new ArtworkError('NOT_FOUND', 'Usuário não encontrado.', 404)
  if (u.stripeCustomerId && u.stripeCustomerMode === mode) return u.stripeCustomerId
  let c
  try { c = await stripeGateway().createCustomer({ email: u.email, name: u.name, metadata: { userId: String(userId) } }, `customer:${mode}:${userId}`) }
  catch (e) { throw stripeFailure(e) }
  const r = await prisma.user.updateMany({ where: { id: userId, stripeCustomerId: u.stripeCustomerId }, data: { stripeCustomerId: c.id, stripeCustomerMode: mode } })
  if (r.count === 0) {
    const now = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { stripeCustomerId: true } })
    return now.stripeCustomerId ?? c.id
  }
  return c.id
}

/** Starts a SetupIntent for the card form (Stripe Elements confirms it in the browser). */
export async function createCardSetup(userId: number): Promise<{ clientSecret: string; publishableKey: string }> {
  assertChargeAllowed()
  const publishableKey = stripePublishableKey()
  if (!publishableKey) throw new ArtworkError('STRIPE_MOCK', 'Cartões reais não estão ligados.', 409)
  const customer = await ensureCustomer(userId)
  let si
  try { si = await stripeGateway().createSetupIntent({ customer, metadata: { userId: String(userId) } }) }
  catch (e) { throw stripeFailure(e) }
  if (!si.client_secret) throw new ArtworkError('PAYMENT_FAILED', 'Não foi possível iniciar o cadastro do cartão.', 502)
  return { clientSecret: si.client_secret, publishableKey }
}

/** The card a succeeded SetupIntent of THIS user saved: only its brand/last4/expiry and the pm_ id. */
export async function cardFromSetupIntent(userId: number, setupIntentId: string): Promise<{ pm: GwPaymentMethod; mode: StripeMode }> {
  const mode = stripeMode()
  if (mode === 'mock') throw new ArtworkError('STRIPE_MOCK', 'Cartões reais não estão ligados.', 409)
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true, stripeCustomerMode: true } })
  if (!u?.stripeCustomerId || u.stripeCustomerMode !== mode) throw new ArtworkError('BAD_SETUP', 'Cadastro de cartão não encontrado.', 400)
  try {
    const si = await stripeGateway().retrieveSetupIntent(setupIntentId)
    if (si.customer !== u.stripeCustomerId) throw new ArtworkError('BAD_SETUP', 'Cadastro de cartão não encontrado.', 400)
    if (si.status !== 'succeeded' || !si.payment_method) throw fail(failureOfStatus(si.status === 'requires_action' ? 'requires_action' : 'requires_payment_method', 'succeeded') ?? NO_CARD)
    const pm = await stripeGateway().retrievePaymentMethod(si.payment_method)
    if (!pm.card || pm.customer !== u.stripeCustomerId) throw new ArtworkError('BAD_SETUP', 'O cartão não foi vinculado à sua conta.', 400)
    return { pm, mode }
  } catch (e) { throw stripeFailure(e) }
}

/** Detaches the card at Stripe (best effort: a card already gone at Stripe does not block the removal here). */
export async function detachCard(providerRef: string, providerMode: string): Promise<void> {
  if (!providerRef.startsWith('pm_') || providerMode !== stripeMode() || providerMode === 'mock') return
  try { await stripeGateway().detachPaymentMethod(providerRef) }
  catch (e) { console.warn('[stripe] detach falhou', (e as { code?: string })?.code ?? (e as Error)?.name) }
}

/** The payer's usable card in the current mode: the chosen one, else the default. */
async function payerCard(userId: number, paymentMethodId: number | null) {
  const mode = stripeMode()
  const where = { userId, status: 'ACTIVE', providerMode: mode }
  return paymentMethodId
    ? prisma.paymentMethod.findFirst({ where: { ...where, id: paymentMethodId } })
    : prisma.paymentMethod.findFirst({ where: { ...where }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
}

async function customerOf(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true, stripeCustomerMode: true } })
  if (!u?.stripeCustomerId || u.stripeCustomerMode !== stripeMode()) throw fail(NO_CARD)
  return u.stripeCustomerId
}

const toCents = (v: bigint): number => {
  if (v <= 0n || v > 99_999_999n) throw new ArtworkError('BAD_AMOUNT', 'Valor fora do limite do cartão.', 400)
  return Number(v)
}

async function confirmIntent(i: { amountCents: bigint; description: string; payerUserId: number; paymentMethodId: number | null; idempotencyKey: string; capture: 'automatic' | 'manual'; metadata: Record<string, string> }): Promise<{ pi: GwPaymentIntent; paymentMethodId: number }> {
  const card = await payerCard(i.payerUserId, i.paymentMethodId)
  if (!card) throw fail(NO_CARD)
  const customer = await customerOf(i.payerUserId)
  let pi: GwPaymentIntent
  try {
    // The key carries the card: Stripe replays a stored decline for the same key for 24 h, so paying
    // again with ANOTHER card must be a new request; the same card stays one charge (double clicks, retries).
    pi = await stripeGateway().createPaymentIntent({ amount: toCents(i.amountCents), currency: 'brl', customer, payment_method: card.providerRef, description: i.description.slice(0, 200), capture_method: i.capture, metadata: { ...i.metadata, userId: String(i.payerUserId) } }, `${i.idempotencyKey}:pm${card.id}`)
  } catch (e) { throw stripeFailure(e) }
  const f = failureOfStatus(pi.status, i.capture === 'manual' ? 'requires_capture' : 'succeeded')
  if (f) {
    // nothing is left half-way at Stripe: a PI that did not reach the state is cancelled
    if (['requires_action', 'requires_payment_method', 'requires_confirmation'].includes(pi.status)) await stripeGateway().cancelPaymentIntent(pi.id, `${i.idempotencyKey}:cancel`).catch(() => null)
    throw fail(f)
  }
  return { pi, paymentMethodId: card.id }
}

let seq = 0

export interface ChargeInput {
  amountCents: bigint
  description: string
  /** Who pays (their default card). Required in test/live; ignored in mock. */
  payerUserId?: number | null
  /** Same key → same charge at Stripe (retries never double-charge). */
  idempotencyKey?: string
  metadata?: Record<string, string>
}

/** Charges now. Mock: paid on the spot; test/live: PaymentIntent off_session with the payer's default card. */
export async function chargeNow(i: ChargeInput): Promise<{ ref: string; paidAt: Date }> {
  assertChargeAllowed()
  if (stripeMode() === 'mock') {
    seq += 1
    return { ref: `mock_ch_${Date.now()}_${seq}`, paidAt: new Date() }
  }
  if (!i.payerUserId) throw fail(NO_CARD)
  const key = i.idempotencyKey ?? `charge:${i.payerUserId}:${randomUUID()}`
  const { pi } = await confirmIntent({ amountCents: i.amountCents, description: i.description, payerUserId: i.payerUserId, paymentMethodId: null, idempotencyKey: key, capture: 'automatic', metadata: { kind: 'charge', ...(i.metadata ?? {}) } })
  return { ref: pi.id, paidAt: new Date() }
}

/** Charges a chosen saved card now (buy now). Test/live only — the mock caller keeps its own ref. */
export async function chargeCard(i: { amountCents: bigint; description: string; payerUserId: number; paymentMethodId: number; idempotencyKey: string; metadata: Record<string, string> }): Promise<{ ref: string; paymentMethodId: number }> {
  assertChargeAllowed()
  const { pi, paymentMethodId } = await confirmIntent({ ...i, capture: 'automatic' })
  return { ref: pi.id, paymentMethodId }
}

/** Authorizes (does not charge) the amount on a saved card: the offer guarantee. Test/live only. */
export async function authorizeHold(i: { amountCents: bigint; description: string; payerUserId: number; paymentMethodId: number | null; idempotencyKey: string; metadata: Record<string, string> }): Promise<{ ref: string; paymentMethodId: number }> {
  assertChargeAllowed()
  const { pi, paymentMethodId } = await confirmIntent({ ...i, capture: 'manual' })
  return { ref: pi.id, paymentMethodId }
}

/** Captures an authorized hold (≤ the authorized amount). */
export async function captureHold(ref: string, amountCents: bigint): Promise<void> {
  try { await stripeGateway().capturePaymentIntent(ref, toCents(amountCents), `capture:${ref}:${amountCents}`) }
  catch (e) { throw stripeFailure(e) }
}

/**
 * Releases an authorized hold and says what the PaymentIntent really ended as. A cancel refused
 * because the PI already moved is NOT assumed released: a concurrent capture (OTP auto-accept ×
 * expiry cron) may have won, and calling that "CANCELLED" would make the deal charge the escrow again.
 */
export async function cancelHold(ref: string): Promise<'CANCELLED' | 'CAPTURED'> {
  try { await stripeGateway().cancelPaymentIntent(ref, `cancel:${ref}`); return 'CANCELLED' }
  catch (e) {
    if ((e as { code?: string })?.code !== 'payment_intent_unexpected_state') throw stripeFailure(e)
    let pi: GwPaymentIntent
    try { pi = await stripeGateway().retrievePaymentIntent(ref) } catch (e2) { throw stripeFailure(e2) }
    if (pi.status === 'canceled') return 'CANCELLED'
    if (pi.status === 'succeeded') return 'CAPTURED'
    throw stripeFailure(e)
  }
}

// ── Pix and boleto (async) ────────────────────────────────────────────────
/**
 * Pix or boleto for an amount: a PaymentIntent confirmed now, paid by the buyer outside (QR / voucher);
 * `payment_intent.succeeded` arrives by webhook. Test/live only — the mock caller draws its own codes.
 * A method the Stripe account has not enabled comes back as a 409 the screen can show.
 */
export async function startAsyncPayment(i: { method: 'PIX' | 'BOLETO'; amountCents: bigint; payerUserId: number; description: string; idempotencyKey: string; metadata: Record<string, string>; billing?: { name: string; email: string; taxId: string; line1: string; city: string; state: string; postalCode: string }; pixExpiresAfterSeconds?: number; boletoExpiresAfterDays?: number }): Promise<{ ref: string; nextAction: unknown }> {
  assertChargeAllowed()
  const customer = await ensureCustomer(i.payerUserId)
  try {
    const pi = await stripeGateway().createAsyncPaymentIntent({
      amount: Number(i.amountCents), customer, method: i.method === 'PIX' ? 'pix' : 'boleto', description: i.description, metadata: i.metadata, billing: i.billing,
      pixExpiresAfterSeconds: i.pixExpiresAfterSeconds, boletoExpiresAfterDays: i.boletoExpiresAfterDays,
    }, i.idempotencyKey)
    return { ref: pi.id, nextAction: pi.nextAction }
  } catch (e) {
    const err = e as { type?: string; code?: string; message?: string }
    // "The payment method type 'pix' is invalid…" / not activated on the account
    if (err?.type === 'StripeInvalidRequestError' && /payment method type|payment_method_types|not activated|not enabled/i.test(err.message ?? '')) {
      throw new ArtworkError('METHOD_UNAVAILABLE', i.method === 'PIX' ? 'Pix ainda não está disponível. Pague com cartão ou boleto.' : 'Boleto ainda não está disponível. Pague com cartão ou Pix.', 409)
    }
    throw stripeFailure(e)
  }
}

/** Cancels a Pix/boleto that was not paid (the deal expired). A PaymentIntent already paid is reported as such. */
export async function cancelAsyncPayment(ref: string): Promise<'CANCELLED' | 'PAID'> {
  try { await stripeGateway().cancelPaymentIntent(ref, `cancel-async:${ref}`); return 'CANCELLED' }
  catch (e) {
    let pi: GwPaymentIntent
    try { pi = await stripeGateway().retrievePaymentIntent(ref) } catch { throw stripeFailure(e) }
    if (pi.status === 'succeeded' || pi.status === 'processing') return 'PAID'
    if (pi.status === 'canceled') return 'CANCELLED'
    throw stripeFailure(e)
  }
}
