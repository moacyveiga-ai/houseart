// Stripe in TEST mode (STRIPE_ENV=test + sk_test_) against an in-memory fake
// injected at the gateway — no test ever calls the real Stripe API. Covers the
// card saved by SetupIntent, the plan and order charges, the offer hold
// (authorize → capture on accept, authorize → cancel on refuse/expire), buy
// now and the webhook (signature, idempotency, reconciliation). The mock path
// with no key is checked to stay untouched.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { acceptOffer, buyNow, expireOffers, listArtworkForSale, refuseOffer, startPublicOffer } from '@/lib/offers/server'
import { addCard, addCardFromSetup, cardFormConfig, listPaymentMethods, removeCard } from '@/lib/payment-methods/server'
import { chargeNow, createCardSetup } from '@/lib/stripe/door'
import { setStripeGatewayForTests } from '@/lib/stripe/gateway-server'
import { totalScope } from '@/lib/scope/context'
import { signStripePayload } from '@/lib/stripe/mode-core'
import { changePlan } from '@/lib/plans/server'
import { placeOrder } from '@/lib/orders/server'
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'
import { DECLINED, FakeStripe, VISA, type FakeCard } from './fake-stripe'

const ENV_KEYS = ['STRIPE_ENV', 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'FLAG_DEALS', 'FLAG_PLANS', 'FLAG_ORDERS'] as const
const saved: Record<string, string | undefined> = {}
const WHSEC = 'whsec_test_houseart'
const PUBLIC_ID = 'HA-2026-TEST-0009'

let s: Scenario
let fake: FakeStripe
let buyerId: number

function testMode() {
  process.env.STRIPE_ENV = 'test'
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake'
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC
}

beforeEach(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  process.env.FLAG_DEALS = '1'; process.env.FLAG_PLANS = '1'; process.env.FLAG_ORDERS = '1'
  testMode()
  fake = new FakeStripe()
  setStripeGatewayForTests(fake)
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'PaymentMethod', 'PlanSubscription', 'Invoice', 'Order', 'StripeEvent'])
  const buyer = await prisma.user.create({ data: { email: 'mariana@col.test', name: 'Mariana Barreto', profile: 'collector', active: true, emailVerifiedAt: new Date(), profiles: { create: { kind: 'COLLECTOR', isDefault: true } } } })
  buyerId = buyer.id
  await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: PUBLIC_ID, heightMm: 1000, widthMm: 800, depthMm: 40 } })
  await asPanel(s.b.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.b.artworkId, { listPriceCents: 3_800_000n, reservePriceCents: 3_000_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  }, 'ARTIST')
})

afterEach(() => {
  setStripeGatewayForTests(null)
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
})

/** The whole card flow as the browser runs it: SetupIntent on the server, Stripe.js confirm, save by id. */
async function saveCard(userId: number, card: FakeCard = VISA, makeDefault = true) {
  const { clientSecret, publishableKey } = await createCardSetup(userId)
  expect(publishableKey).toBe('pk_test_fake')
  const siId = clientSecret.split('_secret_')[0]
  fake.confirmSetupInBrowser(siId, card)
  return (await addCardFromSetup(userId, siId, makeDefault)).method
}

describe('cards by SetupIntent', () => {
  it('saves only brand/last4/expiry and the pm_ id; the card is of the test mode; delete detaches', async () => {
    expect(cardFormConfig()).toEqual({ publishableKey: 'pk_test_fake' })
    const m = await saveCard(buyerId)
    expect(m).toMatchObject({ brand: 'visa', last4: '4242', isDefault: true, exp: '12/34', holderName: 'MARIANA BARRETO' })
    const row = await prisma.paymentMethod.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.providerRef).toMatch(/^pm_/); expect(row.providerMode).toBe('test'); expect(row.billingCep).toBe('40140180')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: buyerId } })
    expect(user.stripeCustomerId).toMatch(/^cus_/); expect(user.stripeCustomerMode).toBe('test')
    // a second setup reuses the customer (one per user and mode)
    await createCardSetup(buyerId)
    expect(fake.customers.size).toBe(1)
    // the raw card number is refused in test mode (it must go through Stripe Elements)
    await expect(addCard(buyerId, { number: '4242 4242 4242 4242', exp: '11/29', cvc: '123', holder: 'M', cep: '40140180' }, false)).rejects.toMatchObject({ code: 'USE_SECURE_FORM', status: 409 })
    // a mock card of before is not listed nor usable in test mode
    await prisma.paymentMethod.create({ data: { userId: buyerId, brand: 'mastercard', last4: '4444', holderName: 'M', expMonth: 1, expYear: 2030, providerRef: 'mock_pm_x', providerMode: 'mock' } })
    expect((await listPaymentMethods(buyerId)).map((x) => x.last4)).toEqual(['4242'])
    // someone else's SetupIntent is refused
    const other = await prisma.user.create({ data: { email: 'outro@col.test', name: 'Outro', profile: 'collector', active: true } })
    await createCardSetup(other.id)
    const siOfBuyer = [...fake.setupIntents.values()].find((x) => x.status === 'succeeded')!.id
    await expect(addCardFromSetup(other.id, siOfBuyer, false)).rejects.toMatchObject({ status: 400 })
    // the same SetupIntent twice is the same row
    expect((await addCardFromSetup(buyerId, siOfBuyer, false)).method.id).toBe(m.id)
    expect(await removeCard(buyerId, m.id)).toBe(true)
    expect(fake.detached).toEqual([row.providerRef])
  })
})

describe('charges (plans and orders)', () => {
  it('plan: no card → 402; with a card a PaymentIntent off_session pays the month; a declined card changes nothing', async () => {
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await expect(changePlan(scope, 'ARTIST_STUDIO', { userId: user.id })).rejects.toMatchObject({ code: 'NO_CARD', status: 402 })
      const declined = await saveCard(user.id, DECLINED)
      await expect(changePlan(scope, 'ARTIST_STUDIO', { userId: user.id })).rejects.toMatchObject({ code: 'CARD_DECLINED', status: 402 })
      expect(await prisma.planSubscription.count({ where: { tenantId: s.b.tenantId } })).toBe(0)
      await removeCard(user.id, declined.id)
      await saveCard(user.id, VISA)
      await changePlan(scope, 'ARTIST_STUDIO', { userId: user.id })
    }, 'ARTIST')
    const sub = await prisma.planSubscription.findFirstOrThrow({ where: { tenantId: s.b.tenantId, status: 'ACTIVE' } })
    expect(sub.stripeSubscriptionId).toMatch(/^pi_/)
    const pi = fake.intents.get(sub.stripeSubscriptionId!)!
    expect(pi).toMatchObject({ status: 'succeeded', capture_method: 'automatic', metadata: { kind: 'plan', plan: 'ARTIST_STUDIO' } })
    const call = fake.calls.find((c) => c.op === 'pi' && c.key?.startsWith('plan:'))
    expect(call?.key).toMatch(new RegExp(`^plan:${s.b.tenantId}:default:ARTIST_STUDIO:pm\\d+$`))
    expect(await prisma.invoice.count({ where: { tenantId: s.b.tenantId, kind: 'PLAN', status: 'PAID' } })).toBe(1)
  })

  it('order: the member pays with their card; the same origin is one charge at Stripe', async () => {
    await saveCard(s.b.userId)
    const o = await placeOrder({ serviceCode: 'TAG_KIT', payerKind: 'ARTIST', quantity: 1, tenantId: s.b.tenantId, memberId: s.b.memberId })
    expect(o?.paymentRef).toMatch(/^pi_/)
    expect(fake.intents.get(o!.paymentRef)!.amount).toBe(Number(o!.amountCents))
    const a = await chargeNow({ amountCents: 1000n, description: 'x', payerUserId: s.b.userId, idempotencyKey: 'order:TEST:transfer:7' })
    const b = await chargeNow({ amountCents: 1000n, description: 'x', payerUserId: s.b.userId, idempotencyKey: 'order:TEST:transfer:7' })
    expect(a.ref).toBe(b.ref)
  })
})

describe('offer guarantee (card hold)', () => {
  const offer = (extra: Partial<Parameters<typeof startPublicOffer>[0]> = {}) => startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, validityHours: 48, guaranteeMethod: 'CARD_HOLD', deliveryCep: '40140-180', buyerUserId: buyerId, ...extra })

  it('authorizes on submit and captures on accept; the deal escrow is the captured hold', async () => {
    await saveCard(buyerId)
    const o = await offer()
    expect(o).toMatchObject({ ok: true }); if (!o.ok) return
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    expect(row.guaranteeRef).toMatch(/^pi_/); expect(row.guaranteeStatus).toBe('AUTHORIZED')
    expect(fake.intents.get(row.guaranteeRef!)).toMatchObject({ status: 'requires_capture', capture_method: 'manual', amount: 3_400_000 })
    await asPanel(s.b.userId, async ({ scope, user }) => { await acceptOffer(scope, row.id, { userId: user.id }) }, 'ARTIST')
    const after = await prisma.offer.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.guaranteeStatus).toBe('CAPTURED')
    expect(fake.intents.get(row.guaranteeRef!)).toMatchObject({ status: 'succeeded', amount_received: 3_400_000 })
    const deal = await prisma.deal.findUniqueOrThrow({ where: { offerId: row.id } })
    expect(deal.phase).toBe('ESCROW'); expect(deal.escrowPaymentRef).toBe(`${row.guaranteeRef}:captured`)
  })

  it('authorizes and cancels on refuse and on expiry; Pix reserve and a declined card are refused', async () => {
    expect(await offer()).toMatchObject({ ok: false, error: expect.stringMatching(/cartão/) })
    await saveCard(buyerId)
    expect(await offer({ guaranteeMethod: 'PIX_RESERVE' })).toMatchObject({ ok: false, error: expect.stringMatching(/Pix/) })
    const o1 = await offer(); if (!o1.ok) throw new Error('o1')
    const r1 = await prisma.offer.findUniqueOrThrow({ where: { code: o1.code } })
    await asPanel(s.b.userId, async ({ scope, user }) => { await refuseOffer(scope, r1.id, { userId: user.id }) }, 'ARTIST')
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: r1.id } })).guaranteeStatus).toBe('CANCELLED')
    expect(fake.intents.get(r1.guaranteeRef!)!.status).toBe('canceled')

    const o2 = await offer(); if (!o2.ok) throw new Error('o2')
    const r2 = await prisma.offer.findUniqueOrThrow({ where: { code: o2.code } })
    await prisma.offer.update({ where: { id: r2.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect(await totalScope('test:cron', () => expireOffers())).toBe(1) // the cron runs it in totalScope
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: r2.id } })).guaranteeStatus).toBe('CANCELLED')
    expect(fake.intents.get(r2.guaranteeRef!)!.status).toBe('canceled')

    const other = await prisma.user.create({ data: { email: 'recusado@col.test', name: 'Recusado', profile: 'collector', active: true, emailVerifiedAt: new Date() } })
    await saveCard(other.id, DECLINED)
    expect(await offer({ buyerUserId: other.id, buyerEmail: 'recusado@col.test' })).toMatchObject({ ok: false, error: 'O cartão foi recusado. Tente outro cartão.' })
  })
})

describe('revisão adversarial: retentativa e corrida da garantia', () => {
  it('a card declined once does not block paying the same deal with another card (key per card)', async () => {
    const { payEscrow } = await import('@/lib/deals/server')
    await saveCard(buyerId, DECLINED)
    const o = await startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, validityHours: 48, guaranteeMethod: 'NONE', deliveryCep: '40140-180', buyerUserId: buyerId })
    if (!o.ok) throw new Error('offer')
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    await asPanel(s.b.userId, async ({ scope, user }) => { await acceptOffer(scope, row.id, { userId: user.id }) }, 'ARTIST')
    const deal = await prisma.deal.findUniqueOrThrow({ where: { offerId: row.id } })
    await expect(payEscrow(buyerId, deal.id)).rejects.toMatchObject({ code: 'CARD_DECLINED' })
    await saveCard(buyerId, VISA)
    await payEscrow(buyerId, deal.id)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).phase).toBe('ESCROW')
    expect(fake.calls.filter((c) => c.op === 'pi').length).toBe(2)
  })

  it('a release that loses to a capture reports CAPTURED, never CANCELLED', async () => {
    await saveCard(buyerId)
    const o = await startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, validityHours: 48, guaranteeMethod: 'CARD_HOLD', deliveryCep: '40140-180', buyerUserId: buyerId })
    if (!o.ok) throw new Error('offer')
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    // the capture happened at Stripe (say, the accept of another path) before our release ran
    await fake.capturePaymentIntent(row.guaranteeRef!, 3_400_000, 'race')
    await prisma.offer.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    await totalScope('test:cron', () => expireOffers())
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: row.id } })).guaranteeStatus).toBe('CAPTURED')
  })
})

describe('buy now', () => {
  it('authorizes the checkout total, writes the offer, captures it; the deal escrow is paid', async () => {
    const c = await saveCard(buyerId)
    const r = await buyNow({ publicId: PUBLIC_ID, buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: null, paymentMethodId: c.id, deliveryCep: '40140180', insurance: true })
    expect(r).toMatchObject({ ok: true }); if (!r.ok) return
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: r.code } })
    expect(row.status).toBe('IN_DEAL'); expect(row.guaranteeStatus).toBe('CAPTURED')
    const total = Number(row.offeredCents + row.shippingCents + row.insuranceCents)
    expect(row.insuranceCents).toBeGreaterThan(0n)
    expect(fake.intents.get(row.guaranteeRef!)).toMatchObject({ status: 'succeeded', amount_received: total })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).phase).toBe('ESCROW')
  })
})

describe('webhook', () => {
  function post(body: string, signature: string | null) {
    return webhookPOST(new Request('http://test/api/stripe/webhook', { method: 'POST', body, headers: signature ? { 'stripe-signature': signature } : {} }))
  }
  const event = (id: string, type: string, piId: string, livemode = false) => JSON.stringify({ id, object: 'event', type, livemode, data: { object: { id: piId, object: 'payment_intent', status: 'succeeded' } } })

  it('rejects a bad signature, is idempotent by event id and reconciles the offer guarantee', async () => {
    await saveCard(buyerId)
    const o = await startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, guaranteeMethod: 'CARD_HOLD', buyerUserId: buyerId })
    if (!o.ok) throw new Error('offer')
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    const body = event('evt_1', 'payment_intent.canceled', row.guaranteeRef!)
    const now = Math.floor(Date.now() / 1000)

    expect((await post(body, null)).status).toBe(400)
    expect((await post(body, signStripePayload(body, 'whsec_wrong', now))).status).toBe(400)
    expect((await post(body, signStripePayload(body, WHSEC, now - 3600))).status).toBe(400)
    expect(await prisma.stripeEvent.count()).toBe(0)

    const ok = await post(body, signStripePayload(body, WHSEC, now))
    expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ ok: true })
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: row.id } })).guaranteeStatus).toBe('CANCELLED')
    const again = await post(body, signStripePayload(body, WHSEC, now))
    expect(again.status).toBe(200); expect(await again.json()).toMatchObject({ duplicate: true })
    expect(await prisma.stripeEvent.count()).toBe(1)
    // a terminal status is never moved by a late event
    const late = event('evt_2', 'payment_intent.succeeded', row.guaranteeRef!)
    expect((await post(late, signStripePayload(late, WHSEC, now))).status).toBe(200)
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: row.id } })).guaranteeStatus).toBe('CANCELLED')
    // a live event in test mode and an unhandled type are acknowledged and ignored (nothing stored)
    const live = event('evt_3', 'payment_intent.succeeded', row.guaranteeRef!, true)
    expect(await (await post(live, signStripePayload(live, WHSEC, now))).json()).toMatchObject({ ignored: 'mode' })
    const other = JSON.stringify({ id: 'evt_4', type: 'customer.created', livemode: false, data: { object: { id: 'cus_1', object: 'customer' } } })
    expect(await (await post(other, signStripePayload(other, WHSEC, now))).json()).toMatchObject({ ignored: 'type' })
    expect(await prisma.stripeEvent.count()).toBe(2)
    // without the secret the endpoint answers 503
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect((await post(body, signStripePayload(body, WHSEC, now))).status).toBe(503)
  })

  it('reconciles an OPEN order to PAID', async () => {
    const o = await prisma.order.create({ data: { code: 'ORD-2026-999999', payerKind: 'BUYER', serviceCode: 'TAG_KIT', description: 'x', amountCents: 1000n, status: 'OPEN', paymentRef: 'pi_open_1' } })
    const body = event('evt_10', 'payment_intent.succeeded', 'pi_open_1')
    expect((await post(body, signStripePayload(body, WHSEC, Math.floor(Date.now() / 1000)))).status).toBe(200)
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'PAID' })
  })
})

describe('no key: the mock stays as it was', () => {
  it('charges and cards never reach the gateway', async () => {
    delete process.env.STRIPE_ENV; delete process.env.STRIPE_SECRET_KEY; delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    expect(cardFormConfig()).toBeNull()
    expect((await chargeNow({ amountCents: 100n, description: 'x' })).ref).toMatch(/^mock_ch_/)
    const c = await addCard(buyerId, { number: '4242 4242 4242 4242', exp: '11/29', cvc: '123', holder: 'Mariana', cep: '40140-180' }, true)
    if (!c.ok) throw new Error(c.error)
    const o = await startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, guaranteeMethod: 'CARD_HOLD', paymentMethodId: c.method.id, buyerUserId: buyerId })
    if (!o.ok) throw new Error('offer')
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    expect(row.guaranteeRef).toMatch(/^mock_hold_/); expect(row.guaranteeStatus).toBeNull()
    await asPanel(s.b.userId, async ({ scope, user }) => { await acceptOffer(scope, row.id, { userId: user.id }) }, 'ARTIST')
    expect((await prisma.deal.findUniqueOrThrow({ where: { offerId: row.id } })).phase).toBe('ESCROW')
    expect(fake.calls).toEqual([])
  })
})
