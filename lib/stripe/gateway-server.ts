// The ONLY place that builds the Stripe client. Everything in lib/ talks to
// Stripe through the narrow `StripeGateway` below, so tests inject a fake
// (`setStripeGatewayForTests`) and the real API is never called by a test.
// Built lazily, once per secret key, only in test/live mode (stripeModeOf).
import 'server-only'
import Stripe from 'stripe'

export interface GwCustomer { id: string }
export interface GwSetupIntent { id: string; client_secret: string | null; status: string; customer: string | null; payment_method: string | null }
export interface GwCard { brand: string | null; last4: string; exp_month: number; exp_year: number }
export interface GwPaymentMethod { id: string; customer: string | null; card: GwCard | null; billing_details: { name: string | null; address: { postal_code: string | null } | null } }
export interface GwPaymentIntent { id: string; status: string; amount: number; amount_capturable: number; amount_received: number; customer: string | null; metadata: Record<string, string> }
export interface GwEvent { id: string; type: string; livemode: boolean; data: { object: GwPaymentIntent } }

export interface PaymentIntentInput {
  amount: number
  currency: 'brl'
  customer: string
  payment_method: string
  description: string
  capture_method: 'automatic' | 'manual'
  metadata: Record<string, string>
}

export interface StripeGateway {
  createCustomer(p: { email: string; name: string; metadata: Record<string, string> }, idempotencyKey: string): Promise<GwCustomer>
  createSetupIntent(p: { customer: string; metadata: Record<string, string> }): Promise<GwSetupIntent>
  retrieveSetupIntent(id: string): Promise<GwSetupIntent>
  retrievePaymentMethod(id: string): Promise<GwPaymentMethod>
  detachPaymentMethod(id: string): Promise<void>
  /** off_session + confirm=true: charges (or authorizes, with manual capture) the saved card now. */
  createPaymentIntent(p: PaymentIntentInput, idempotencyKey: string): Promise<GwPaymentIntent>
  capturePaymentIntent(id: string, amountToCapture: number, idempotencyKey: string): Promise<GwPaymentIntent>
  cancelPaymentIntent(id: string, idempotencyKey: string): Promise<GwPaymentIntent>
}

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null)

function toPi(pi: Stripe.PaymentIntent): GwPaymentIntent {
  return { id: pi.id, status: pi.status, amount: pi.amount, amount_capturable: pi.amount_capturable, amount_received: pi.amount_received, customer: idOf(pi.customer), metadata: { ...(pi.metadata ?? {}) } }
}
function toSi(si: Stripe.SetupIntent): GwSetupIntent {
  return { id: si.id, client_secret: si.client_secret, status: si.status, customer: idOf(si.customer), payment_method: idOf(si.payment_method) }
}

/** Adapter over the official SDK (stripe@22). */
export function realGateway(secretKey: string): StripeGateway {
  const s = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'HouseArt' } })
  return {
    async createCustomer(p, idempotencyKey) { const c = await s.customers.create(p, { idempotencyKey }); return { id: c.id } },
    async createSetupIntent(p) { return toSi(await s.setupIntents.create({ customer: p.customer, usage: 'off_session', payment_method_types: ['card'], metadata: p.metadata })) },
    async retrieveSetupIntent(id) { return toSi(await s.setupIntents.retrieve(id)) },
    async retrievePaymentMethod(id) {
      const pm = await s.paymentMethods.retrieve(id)
      return {
        id: pm.id, customer: idOf(pm.customer),
        card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year } : null,
        billing_details: { name: pm.billing_details?.name ?? null, address: { postal_code: pm.billing_details?.address?.postal_code ?? null } },
      }
    },
    async detachPaymentMethod(id) { await s.paymentMethods.detach(id) },
    async createPaymentIntent(p, idempotencyKey) {
      return toPi(await s.paymentIntents.create({ ...p, off_session: true, confirm: true }, { idempotencyKey }))
    },
    async capturePaymentIntent(id, amountToCapture, idempotencyKey) { return toPi(await s.paymentIntents.capture(id, { amount_to_capture: amountToCapture }, { idempotencyKey })) },
    async cancelPaymentIntent(id, idempotencyKey) { return toPi(await s.paymentIntents.cancel(id, {}, { idempotencyKey })) },
  }
}

let injected: StripeGateway | null = null
let cached: { key: string; gw: StripeGateway } | null = null

/** The gateway for the current secret key (callers check the mode first). */
export function stripeGateway(): StripeGateway {
  if (injected) return injected
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!cached || cached.key !== key) cached = { key, gw: realGateway(key) }
  return cached.gw
}

/** Tests only: a fake in place of the SDK (null restores the real one). */
export function setStripeGatewayForTests(gw: StripeGateway | null): void {
  injected = gw
}
