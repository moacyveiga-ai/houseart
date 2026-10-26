// Pix and boleto for the escrow of a deal (checkout of the prototype: Pix · Cartão · Boleto).
// Test mode against the in-memory Stripe; the mock path draws its own codes and "Simular pagamento".
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { buyNow, listArtworkForSale } from '@/lib/offers/server'
import { expireUnpaidEscrows, payEscrow, pendingEscrowOf, simulateEscrowPayment, startEscrowPayment } from '@/lib/deals/server'
import { setStripeGatewayForTests } from '@/lib/stripe/gateway-server'
import { signStripePayload } from '@/lib/stripe/mode-core'
import { totalScope } from '@/lib/scope/context'
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'
import { FakeStripe } from './fake-stripe'

const ENV_KEYS = ['STRIPE_ENV', 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'FLAG_DEALS'] as const
const saved: Record<string, string | undefined> = {}
const WHSEC = 'whsec_test_houseart'
const PUBLIC_ID = 'HA-2026-TEST-0011'
const BILLING = { name: 'Mariana Barreto', email: 'mariana@col.test', taxId: '52998224725', line1: 'Rua das Laranjeiras, 214', city: 'Salvador', state: 'BA', postalCode: '40140180' }

let s: Scenario
let fake: FakeStripe
let buyerId: number

function testMode() {
  process.env.STRIPE_ENV = 'test'
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake'
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC
}
const buy = (method: 'PIX' | 'BOLETO', billing: typeof BILLING | null = null) => buyNow({ publicId: PUBLIC_ID, buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: null, paymentMethodId: null, deliveryCep: '40140180', insurance: true, method, billing })

async function sendSucceeded(piId: string, eventId: string, metadata: Record<string, string> = {}) {
  const body = JSON.stringify({ id: eventId, object: 'event', type: 'payment_intent.succeeded', livemode: false, data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata } } })
  const signature = signStripePayload(body, WHSEC, Math.floor(Date.now() / 1000))
  return webhookPOST(new Request('http://test/api/stripe/webhook', { method: 'POST', body, headers: { 'stripe-signature': signature } }))
}

beforeEach(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  process.env.FLAG_DEALS = '1'
  fake = new FakeStripe()
  setStripeGatewayForTests(fake)
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'PaymentMethod', 'Invoice', 'StripeEvent'])
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

describe('Pix e boleto na garantia do negócio', () => {
  it('Pix (test mode): reserves the artwork, shows the QR, the webhook pays the escrow once', async () => {
    testMode()
    const r = await buy('PIX')
    if (!r.ok) throw new Error(r.error)
    expect(r.instructions).toMatchObject({ method: 'PIX', pixCode: expect.stringContaining('FAKEPIX') })
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })
    expect(deal).toMatchObject({ phase: 'OFFER_ACCEPTED', escrowMethod: 'PIX', escrowPaidAt: null })
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('IN_DEAL')
    expect(await pendingEscrowOf(buyerId, deal.id)).toMatchObject({ method: 'PIX' })
    // asking again returns the same Pix (no second PaymentIntent)
    const again = await startEscrowPayment(buyerId, deal.id, 'PIX')
    expect(again.instructions?.pixCode).toBe(r.instructions?.pixCode)
    expect(fake.calls.filter((c) => c.op === 'async_intent')).toHaveLength(1)
    fake.payAsync(deal.escrowPendingRef!)
    expect((await sendSucceeded(deal.escrowPendingRef!, 'evt_pix_1')).status).toBe(200)
    expect((await sendSucceeded(deal.escrowPendingRef!, 'evt_pix_1')).status).toBe(200)
    const paid = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })
    expect(paid).toMatchObject({ phase: 'ESCROW', escrowMethod: 'PIX', escrowPendingRef: null })
    expect(paid.escrowPaidAt).not.toBeNull()
    expect(await prisma.dealPhaseEvent.count({ where: { dealId: deal.id, phase: 'ESCROW' } })).toBe(1)
  })

  it('boleto needs who pays and the address; the voucher comes back', async () => {
    testMode()
    expect(await buy('BOLETO', { ...BILLING, taxId: '1' })).toMatchObject({ ok: false })
    expect(await totalScope('test:offers', () => prisma.offer.count())).toBe(0)
    const r = await buy('BOLETO', BILLING)
    if (!r.ok) throw new Error(r.error)
    expect(r.instructions).toMatchObject({ method: 'BOLETO', boletoPdfUrl: expect.stringContaining('.pdf') })
  })

  it('an unpaid Pix past its deadline cancels the deal and puts the artwork back on sale', async () => {
    testMode()
    const r = await buy('PIX')
    if (!r.ok) throw new Error(r.error)
    const ref = (await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).escrowPendingRef!
    expect(await expireUnpaidEscrows(new Date(Date.now() + 23 * 3600_000))).toBe(0)
    expect(await expireUnpaidEscrows(new Date(Date.now() + 25 * 3600_000))).toBe(1)
    const d = await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })
    expect(d.exceptionStatus).toBe('CANCELLED')
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('LISTED')
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: d.offerId } })).status).toBe('CANCELLED')
    // a late payment does not revive it — it is given back
    fake.payAsync(ref)
    expect((await sendSucceeded(ref, 'evt_late', { kind: 'deal_escrow', dealId: String(d.id) })).status).toBe(200)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: d.id } })).escrowPaidAt).toBeNull()
    expect(fake.calls.filter((c) => c.op === 'refund')).toHaveLength(1)
  })

  it('switching from Pix to a card that fails keeps the deadline: the cron still lets the artwork go', async () => {
    testMode()
    const r = await buy('PIX')
    if (!r.ok) throw new Error(r.error)
    await expect(payEscrow(buyerId, r.dealId!)).rejects.toThrow()
    const d = await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })
    expect(d.escrowPendingRef).toBeNull()
    expect(d.escrowExpiresAt).not.toBeNull()
    expect(await expireUnpaidEscrows(new Date(Date.now() + 25 * 3600_000))).toBe(1)
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('LISTED')
  })

  it('a Pix asked again after a switch is a NEW PaymentIntent, never the cancelled one replayed', async () => {
    testMode()
    const r = await buy('PIX')
    if (!r.ok) throw new Error(r.error)
    const first = (await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).escrowPendingRef
    await startEscrowPayment(buyerId, r.dealId!, 'BOLETO', BILLING)
    await startEscrowPayment(buyerId, r.dealId!, 'PIX')
    const again = (await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).escrowPendingRef
    expect(again).not.toBe(first)
    expect((await fake.retrievePaymentIntent(again!)).status).toBe('requires_action')
  })

  it('a boleto past its due date waits the grace; one clearing refuses a switch', async () => {
    testMode()
    const r = await buy('BOLETO', BILLING)
    if (!r.ok) throw new Error(r.error)
    const ref = (await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).escrowPendingRef!
    expect(await expireUnpaidEscrows(new Date(Date.now() + 4 * 86_400_000))).toBe(0)
    fake.processAsync(ref)
    await expect(startEscrowPayment(buyerId, r.dealId!, 'PIX')).rejects.toMatchObject({ code: 'PAYMENT_PROCESSING' })
    expect(await expireUnpaidEscrows(new Date(Date.now() + 7 * 86_400_000))).toBe(0)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).exceptionStatus).toBeNull()
  })

  it('mock: codes drawn by us and "Simular pagamento" pays', async () => {
    delete process.env.STRIPE_ENV; delete process.env.STRIPE_SECRET_KEY
    const r = await buy('PIX')
    if (!r.ok) throw new Error(r.error)
    expect(r.instructions).toMatchObject({ mock: true, pixQrUrl: expect.stringMatching(/^data:image\/png/) })
    await simulateEscrowPayment(buyerId, r.dealId!)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })).phase).toBe('ESCROW')
  })
})
