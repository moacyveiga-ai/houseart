// An in-memory Stripe for the integration tests (injected with
// setStripeGatewayForTests). It keeps the parts of Stripe's behaviour the code
// relies on: idempotency keys return the first result, off_session confirm of
// a saved card gives `succeeded` (or `requires_capture` with manual capture),
// a card marked as declining throws a StripeCardError, capture ≤ capturable,
// cancel only before success. Nothing here talks to the network.
import type { AccountInput, AsyncIntentInput, GwAccount, GwPaymentIntent, GwPaymentMethod, GwSetupIntent, GwTransfer, PaymentIntentInput, StripeGateway, TransferInput } from '@/lib/stripe/gateway-server'

export interface FakeCard { brand: string; last4: string; exp_month: number; exp_year: number; declines?: 'card_declined' | 'authentication_required' }

export class FakeStripe implements StripeGateway {
  seq = 0
  customers = new Map<string, { email: string; name: string }>()
  setupIntents = new Map<string, GwSetupIntent>()
  paymentMethods = new Map<string, GwPaymentMethod & { declines?: FakeCard['declines'] }>()
  intents = new Map<string, GwPaymentIntent & { capture_method: string; payment_method: string }>()
  detached: string[] = []
  accounts = new Map<string, GwAccount & { email: string; business_type: string }>()
  transfers = new Map<string, GwTransfer>()
  /** When set, every createTransfer throws this Stripe-shaped error (balance_insufficient, account restricted…). */
  transferFailure: { type: string; code: string } | null = null
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
      if (pi.status === 'succeeded' || pi.status === 'canceled' || pi.status === 'processing') throw Object.assign(new Error('unexpected state'), { type: 'StripeInvalidRequestError', code: 'payment_intent_unexpected_state' })
      pi.status = 'canceled'; pi.amount_capturable = 0
      return { ...pi }
    })
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  async createAccount(p: AccountInput, idempotencyKey: string) {
    this.calls.push({ op: 'account', key: idempotencyKey, params: p })
    return this.once(idempotencyKey, () => {
      const id = this.id('acct')
      const a = { id, details_submitted: false, charges_enabled: false, payouts_enabled: false, requirements: { currently_due: ['external_account', 'individual.id_number', 'tos_acceptance.date'], past_due: [], disabled_reason: 'requirements.past_due' }, transfersCapability: 'inactive', email: p.email, business_type: p.business_type }
      this.accounts.set(id, a)
      return this.snapshot(id)
    })
  }
  async createAccountLink(p: { account: string; refresh_url: string; return_url: string }) {
    this.calls.push({ op: 'account_link', params: p })
    if (!this.accounts.has(p.account)) throw Object.assign(new Error('No such account'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
    return { url: `https://connect.stripe.com/setup/e/${p.account}/fake` }
  }
  async retrieveAccount(id: string) {
    if (!this.accounts.has(id)) throw Object.assign(new Error('No such account'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
    return this.snapshot(id)
  }
  async listTransfers(transferGroup: string) {
    this.calls.push({ op: 'transfers_list', params: { transferGroup } })
    return [...this.transfers.values()].filter((t) => t.transfer_group === transferGroup).map((t) => ({ ...t }))
  }
  async createAsyncPaymentIntent(p: AsyncIntentInput, idempotencyKey: string) {
    this.calls.push({ op: 'async_intent', key: idempotencyKey, params: p })
    return this.once(idempotencyKey, () => {
      const id = this.id('pi')
      this.intents.set(id, { id, status: 'requires_action', amount: p.amount, amount_capturable: 0, amount_received: 0, customer: p.customer, metadata: { ...p.metadata }, capture_method: 'automatic', payment_method: p.method })
      const exp = Math.floor(Date.now() / 1000) + (p.method === 'pix' ? (p.pixExpiresAfterSeconds ?? 86_400) : (p.boletoExpiresAfterDays ?? 3) * 86_400)
      const nextAction = p.method === 'pix'
        ? { pix_display_qr_code: { data: `000201FAKEPIX${id}`, image_url_png: `https://qr.stripe.test/${id}.png`, expires_at: exp, hosted_instructions_url: `https://payments.stripe.test/${id}` } }
        : { boleto_display_details: { number: '00190000090000000000000000000000000000000000000', pdf: `https://payments.stripe.test/${id}.pdf`, hosted_voucher_url: `https://payments.stripe.test/${id}`, expires_at: exp } }
      return { id, status: 'requires_action', nextAction }
    })
  }
  async refundPaymentIntent(id: string, idempotencyKey: string) {
    this.calls.push({ op: 'refund', key: idempotencyKey, params: { id } })
    return this.once(idempotencyKey, () => ({ id: this.id('re') }))
  }
  /** What the bank is doing: the boleto was paid and is clearing. */
  processAsync(id: string) { this.intents.get(id)!.status = 'processing' }
  /** What the bank does: the Pix/boleto was paid (the test then sends payment_intent.succeeded). */
  payAsync(id: string) { const pi = this.intents.get(id)!; pi.status = 'succeeded'; pi.amount_received = pi.amount }
  async createLoginLink(account: string) {
    this.calls.push({ op: 'login_link', params: { account } })
    return { url: `https://connect.stripe.com/express/${account}/fake` }
  }
  async createTransfer(p: TransferInput, idempotencyKey: string) {
    this.calls.push({ op: 'transfer', key: idempotencyKey, params: p })
    return this.once(idempotencyKey, () => {
      if (this.transferFailure) throw Object.assign(new Error('transfer refused'), this.transferFailure)
      const a = this.accounts.get(p.destination)
      if (!a) throw Object.assign(new Error('No such destination'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
      if (a.transfersCapability !== 'active') throw Object.assign(new Error('capability inactive'), { type: 'StripeInvalidRequestError', code: 'account_invalid' })
      const t: GwTransfer = { id: this.id('tr'), amount: p.amount, destination: p.destination, transfer_group: p.transfer_group, reversed: false, amount_reversed: 0, metadata: { ...p.metadata } }
      this.transfers.set(t.id, t)
      return { ...t }
    })
  }
  /** What the person does on Stripe's hosted onboarding: everything submitted and verified (or only submitted, still pending). */
  completeOnboarding(accountId: string, verified = true) {
    const a = this.accounts.get(accountId)!
    a.details_submitted = true
    a.requirements = verified ? { currently_due: [], past_due: [], disabled_reason: null } : { currently_due: ['individual.verification.document'], past_due: [], disabled_reason: 'requirements.pending_verification' }
    a.charges_enabled = verified; a.payouts_enabled = verified; a.transfersCapability = verified ? 'active' : 'pending'
  }
  /** The account as Stripe sends it in `account.updated` (data.object) and in retrieve. */
  snapshot(accountId: string): GwAccount {
    const a = this.accounts.get(accountId)!
    return { id: a.id, details_submitted: a.details_submitted, charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, requirements: { ...a.requirements, currently_due: [...a.requirements.currently_due], past_due: [...a.requirements.past_due] }, transfersCapability: a.transfersCapability }
  }
  /** The raw `data.object` of an account.updated event, as the webhook parses it. */
  accountEventObject(accountId: string) {
    const a = this.snapshot(accountId)
    return { object: 'account', id: a.id, details_submitted: a.details_submitted, charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, requirements: a.requirements, capabilities: { transfers: a.transfersCapability } }
  }
}

export const VISA: FakeCard = { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 }
export const DECLINED: FakeCard = { brand: 'visa', last4: '0002', exp_month: 12, exp_year: 2034, declines: 'card_declined' }
