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

// ── Connect ───────────────────────────────────────────────────────────────
export interface GwAccount {
  id: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements: { currently_due: string[]; past_due: string[]; disabled_reason: string | null }
  /** `capabilities.transfers` ('active' | 'inactive' | 'pending'), null when Stripe did not send it. */
  transfersCapability: string | null
}
export interface GwTransfer { id: string; amount: number; destination: string; transfer_group: string | null; reversed: boolean; amount_reversed: number; metadata: Record<string, string> }
export interface AccountInput { email: string; business_type: 'individual' | 'company'; metadata: Record<string, string> }
export interface TransferInput { amount: number; currency: 'brl'; destination: string; transfer_group: string; metadata: Record<string, string> }

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
  retrievePaymentIntent(id: string): Promise<GwPaymentIntent>
  // Connect (Express, Brazil): the seller's account, its onboarding link, its state, the transfers that pay the split.
  createAccount(p: AccountInput, idempotencyKey: string): Promise<GwAccount>
  createAccountLink(p: { account: string; refresh_url: string; return_url: string }): Promise<{ url: string }>
  retrieveAccount(id: string): Promise<GwAccount>
  /** A plain transfer from the platform balance (no source_transaction): the escrow PaymentIntent already funded it. */
  createTransfer(p: TransferInput, idempotencyKey: string): Promise<GwTransfer>
  /** The transfers of a group (a deal code): the lookup that keeps a line at ONE transfer when our write after a success was lost. */
  listTransfers(transferGroup: string): Promise<GwTransfer[]>
  createLoginLink(account: string): Promise<{ url: string }>
}

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null)

function toPi(pi: Stripe.PaymentIntent): GwPaymentIntent {
  return { id: pi.id, status: pi.status, amount: pi.amount, amount_capturable: pi.amount_capturable, amount_received: pi.amount_received, customer: idOf(pi.customer), metadata: { ...(pi.metadata ?? {}) } }
}
export function toAccount(a: Stripe.Account): GwAccount {
  return {
    id: a.id, details_submitted: !!a.details_submitted, charges_enabled: !!a.charges_enabled, payouts_enabled: !!a.payouts_enabled,
    requirements: { currently_due: [...(a.requirements?.currently_due ?? [])], past_due: [...(a.requirements?.past_due ?? [])], disabled_reason: a.requirements?.disabled_reason ?? null },
    transfersCapability: a.capabilities?.transfers ?? null,
  }
}
function toTransfer(t: Stripe.Transfer): GwTransfer {
  return { id: t.id, amount: t.amount, destination: idOf(t.destination) ?? '', transfer_group: t.transfer_group ?? null, reversed: !!t.reversed, amount_reversed: t.amount_reversed, metadata: { ...(t.metadata ?? {}) } }
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
    async retrievePaymentIntent(id) { return toPi(await s.paymentIntents.retrieve(id)) },
    async createAccount(p, idempotencyKey) {
      return toAccount(await s.accounts.create({ type: 'express', country: 'BR', email: p.email, business_type: p.business_type, capabilities: { transfers: { requested: true } }, metadata: p.metadata }, { idempotencyKey }))
    },
    async createAccountLink(p) { const l = await s.accountLinks.create({ account: p.account, refresh_url: p.refresh_url, return_url: p.return_url, type: 'account_onboarding' }); return { url: l.url } },
    async retrieveAccount(id) { return toAccount(await s.accounts.retrieve(id)) },
    async createTransfer(p, idempotencyKey) { return toTransfer(await s.transfers.create(p, { idempotencyKey })) },
    async listTransfers(transferGroup) { const l = await s.transfers.list({ transfer_group: transferGroup, limit: 100 }); return l.data.map(toTransfer) },
    async createLoginLink(account) { const l = await s.accounts.createLoginLink(account); return { url: l.url } },
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
