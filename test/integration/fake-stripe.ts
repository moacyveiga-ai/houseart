// An in-memory Stripe for the integration tests (injected with
// setStripeGatewayForTests). It keeps the parts of Stripe's behaviour the code
// relies on: idempotency keys return the first result, off_session confirm of
// a saved card gives `succeeded` (or `requires_capture` with manual capture),
// a card marked as declining throws a StripeCardError, capture ≤ capturable,
// cancel only before success. Nothing here talks to the network.
import type { GwPaymentIntent, GwPaymentMethod, GwSetupIntent, PaymentIntentInput, StripeGateway } from '@/lib/stripe/gateway-server'

export interface FakeCard { brand: string; last4: string; exp_month: number; exp_year: number; declines?: 'card_declined' | 'authentication_required' }

export class FakeStripe implements StripeGateway {
  seq = 0
  customers = new Map<string, { email: string; name: string }>()
  setupIntents = new Map<string, GwSetupIntent>()
  paymentMethods = new Map<string, GwPaymentMethod & { declines?: FakeCard['declines'] }>()
  intents = new Map<string, GwPaymentIntent & { capture_method: string; payment_method: string }>()
  detached: string[] = []
  calls: { op: string; key?: string; params?: unknown }[] = []
  private idem = new Map<string, unknown>()

  private id(prefix: string) { this.seq += 1; return `${prefix}_fake${this.seq}` }
  private once<T>(key: string | undefined, fn: () => T): T {
    if (key && this.idem.has(key)) { const prev = this.idem.get(key) as { error?: unknown; value?: T }; if ('error' in prev) throw prev.error; return prev.value as T }
    // like Stripe: a request that ran (including a card decline) is stored under its key and replayed
    try { const value = fn(); if (key) this.idem.set(key, { value }); return value }
    catch (error) { if (key) this.idem.set(key, { error }); throw error }
  }

  async createCustomer(p: { email: string; name: string }, idempotencyKey: string) {
    this.calls.push({ op: 'customer', key: idempotencyKey })
    return this.once(idempotencyKey, () => { const id = this.id('cus'); this.customers.set(id, p); return { id } })
  }
  async createSetupIntent(p: { customer: string }) {
    this.calls.push({ op: 'setup', params: p })
    const id = this.id('seti')
    const si: GwSetupIntent = { id, client_secret: `${id}_secret_x`, status: 'requires_payment_method', customer: p.customer, payment_method: null }
    this.setupIntents.set(id, si)
    return { ...si }
  }
  /** What Stripe.js does in the browser: the card is confirmed and attached to the SetupIntent's customer. */
  confirmSetupInBrowser(setupIntentId: string, card: FakeCard, billing = { name: 'MARIANA BARRETO', postal_code: '40140180' }): string {
    const si = this.setupIntents.get(setupIntentId)!
    const pmId = this.id('pm')
    this.paymentMethods.set(pmId, { id: pmId, customer: si.customer, card: { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year }, billing_details: { name: billing.name, address: { postal_code: billing.postal_code } }, declines: card.declines })
    si.status = 'succeeded'; si.payment_method = pmId
    return pmId
  }
  async retrieveSetupIntent(id: string) {
    const si = this.setupIntents.get(id)
    if (!si) throw Object.assign(new Error('No such setupintent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
    return { ...si }
  }
  async retrievePaymentMethod(id: string) {
    const pm = this.paymentMethods.get(id)
    if (!pm) throw Object.assign(new Error('No such payment_method'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
    return { id: pm.id, customer: pm.customer, card: pm.card, billing_details: pm.billing_details }
  }
  async detachPaymentMethod(id: string) {
    this.detached.push(id)
    const pm = this.paymentMethods.get(id); if (pm) pm.customer = null
  }
  async createPaymentIntent(p: PaymentIntentInput, idempotencyKey: string) {
    this.calls.push({ op: 'pi', key: idempotencyKey, params: p })
    return this.once(idempotencyKey, () => {
      const pm = this.paymentMethods.get(p.payment_method)
      if (!pm || pm.customer !== p.customer) throw Object.assign(new Error('pm not attached'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
      if (pm.declines) throw Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', code: pm.declines, decline_code: 'generic_decline' })
      const manual = p.capture_method === 'manual'
      const pi = { id: this.id('pi'), status: manual ? 'requires_capture' : 'succeeded', amount: p.amount, amount_capturable: manual ? p.amount : 0, amount_received: manual ? 0 : p.amount, customer: p.customer, metadata: p.metadata, capture_method: p.capture_method, payment_method: p.payment_method }
      this.intents.set(pi.id, pi)
      return { ...pi }
    })
  }
  async capturePaymentIntent(id: string, amountToCapture: number, idempotencyKey: string) {
    this.calls.push({ op: 'capture', key: idempotencyKey, params: { id, amountToCapture } })
    return this.once(idempotencyKey, () => {
      const pi = this.intents.get(id)!
      if (pi.status !== 'requires_capture' || amountToCapture > pi.amount_capturable) throw Object.assign(new Error('unexpected state'), { type: 'StripeInvalidRequestError', code: 'payment_intent_unexpected_state' })
      pi.status = 'succeeded'; pi.amount_received = amountToCapture; pi.amount_capturable = 0
      return { ...pi }
    })
  }
  async retrievePaymentIntent(id: string) {
    const pi = this.intents.get(id)
    if (!pi) throw Object.assign(new Error('no such payment_intent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
    return { ...pi }
  }
  async cancelPaymentIntent(id: string, idempotencyKey: string) {
    this.calls.push({ op: 'cancel', key: idempotencyKey, params: { id } })
    return this.once(idempotencyKey, () => {
      const pi = this.intents.get(id)!
      if (pi.status === 'succeeded' || pi.status === 'canceled') throw Object.assign(new Error('unexpected state'), { type: 'StripeInvalidRequestError', code: 'payment_intent_unexpected_state' })
      pi.status = 'canceled'; pi.amount_capturable = 0
      return { ...pi }
    })
  }
}

export const VISA: FakeCard = { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 }
export const DECLINED: FakeCard = { brand: 'visa', last4: '0002', exp_month: 12, exp_year: 2034, declines: 'card_declined' }
