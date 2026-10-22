// Handoff Fase 4: saved cards, guarantee at the offer (hold captured on accept), direct purchase, Pix payout, identity.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { acceptOffer, buyNow, buyerOffer, listArtworkForSale, offersOfUser, startPublicOffer } from '@/lib/offers/server'
import { addCard, listPaymentMethods, payoutAccountOf, removeCard, setDefaultCard, setPayoutAccount } from '@/lib/payment-methods/server'
import { identityOf, setIdentity } from '@/lib/accounts/identity-server'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'

let s: Scenario
let buyerId: number
beforeEach(async () => {
  process.env.FLAG_DEALS = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'PaymentMethod', 'PayoutAccount'])
  const buyer = await prisma.user.create({ data: { email: 'mariana@col.test', name: 'Mariana Barreto', profile: 'collector', active: true, emailVerifiedAt: new Date(), profiles: { create: { kind: 'COLLECTOR', isDefault: true } } } })
  buyerId = buyer.id
  await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0004', heightMm: 1000, widthMm: 800, depthMm: 40 } })
  await asPanel(s.b.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.b.artworkId, { listPriceCents: 3_800_000n, reservePriceCents: 3_000_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  }, 'ARTIST')
})

const card = { number: '4242 4242 4242 4242', exp: '11/29', cvc: '123', holder: 'Mariana Barreto', cep: '40140-180' }

describe('cards', () => {
  it('saves brand/last4 only, first is default, remove promotes the next', async () => {
    const a = await addCard(buyerId, card, false)
    expect(a).toMatchObject({ ok: true, method: { brand: 'visa', last4: '4242', isDefault: true, label: 'Visa •••• 4242' } })
    const b = await addCard(buyerId, { ...card, number: '5555 5555 5555 4444' }, false)
    expect(b).toMatchObject({ ok: true, method: { brand: 'mastercard', isDefault: false } })
    expect(await addCard(buyerId, { ...card, number: '1111' }, false)).toMatchObject({ ok: false })
    const rows = await prisma.paymentMethod.findMany()
    expect(JSON.stringify(rows)).not.toContain('4242424242424242')
    if (!b.ok || !a.ok) return
    expect(await setDefaultCard(buyerId, b.method.id)).toBe(true)
    expect((await listPaymentMethods(buyerId)).map((m) => [m.last4, m.isDefault])).toEqual([['4444', true], ['4242', false]])
    expect(await removeCard(buyerId, b.method.id)).toBe(true)
    expect((await listPaymentMethods(buyerId)).map((m) => [m.last4, m.isDefault])).toEqual([['4242', true]])
    expect(await removeCard(s.b.userId, a.method.id)).toBe(false)
  }, 60_000)
})

describe('offer with guarantee (verified buyer, no OTP)', () => {
  it('freezes validity and quote, skips the OTP, and the accept captures the hold into escrow', async () => {
    const c = await addCard(buyerId, card, true); if (!c.ok) throw new Error(c.error)
    // a card hold without a session is refused
    expect(await startPublicOffer({ publicId: 'HA-2026-TEST-0004', buyerName: 'Anon', buyerEmail: 'anon@col.test', buyerDocument: '52998224725', offeredCents: 3_400_000n, guaranteeMethod: 'CARD_HOLD' })).toMatchObject({ ok: false })
    const o = await startPublicOffer({ publicId: 'HA-2026-TEST-0004', buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', buyerCity: 'Salvador/BA', offeredCents: 3_400_000n, validityHours: 48, guaranteeMethod: 'CARD_HOLD', paymentMethodId: c.method.id, deliveryCep: '40140-180', buyerUserId: buyerId, message: 'Adorei a obra.' })
    expect(o).toMatchObject({ ok: true, confirmed: true })
    if (!o.ok) return
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })
    expect(row.status).toBe('RECEIVED'); expect(row.otpHash).toBeNull(); expect(row.validityHours).toBe(48); expect(row.guaranteeMethod).toBe('CARD_HOLD'); expect(row.guaranteeRef).toMatch(/^mock_hold_/)
    expect(row.shippingCents).toBeGreaterThan(0n); expect(row.insuranceCents).toBeGreaterThan(0n); expect(row.deliveryCep).toBe('40140180')
    expect(Math.round((row.expiresAt.getTime() - row.createdAt.getTime()) / 3_600_000)).toBe(48)
    // the logged owner opens the page without a token; a stranger does not
    const view = await buyerOffer(o.code, { userId: buyerId })
    expect(view).toMatchObject({ status: 'RECEIVED', guaranteeMethod: 'CARD_HOLD', validityHours: 48 })
    expect(await buyerOffer(o.code, { userId: s.b.userId })).toBeNull()
    expect((await offersOfUser(buyerId)).map((x) => x.code)).toEqual([o.code])
    // the seller accepts → deal + escrow captured from the hold
    await asPanel(s.b.userId, async ({ scope, user }) => { await acceptOffer(scope, row.id, { userId: user.id }) }, 'ARTIST')
    const deal = await prisma.deal.findUniqueOrThrow({ where: { offerId: row.id } })
    expect(deal.phase).toBe('ESCROW'); expect(deal.escrowPaymentRef).toMatch(/captured$/); expect(deal.shippingCents).toBe(row.shippingCents); expect(deal.buyerUserId).toBe(buyerId)
  }, 60_000)
})

describe('direct purchase', () => {
  it('buys at the list price under the artwork lock; escrow paid; a second buyer is refused', async () => {
    expect(await buyNow({ publicId: 'HA-2026-TEST-0004', buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: null, paymentMethodId: null, deliveryCep: '40140180', insurance: true })).toMatchObject({ ok: false })
    const c = await addCard(buyerId, card, true); if (!c.ok) throw new Error(c.error)
    const r = await buyNow({ publicId: 'HA-2026-TEST-0004', buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', buyerDocument: '52998224725', paymentMethodId: c.method.id, deliveryCep: '40140180', insurance: true })
    expect(r).toMatchObject({ ok: true }); if (!r.ok) return
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: r.code } })
    expect(row.status).toBe('IN_DEAL'); expect(row.offeredCents).toBe(3_800_000n)
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: r.dealId! } })
    expect(deal.phase).toBe('ESCROW'); expect(deal.amountCents).toBe(3_800_000n); expect(deal.insuranceCents).toBeGreaterThan(0n)
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('IN_DEAL')
    const other = await prisma.user.create({ data: { email: 'outro@col.test', name: 'Outro', profile: 'collector', active: true } })
    const oc = await addCard(other.id, card, true); if (!oc.ok) throw new Error(oc.error)
    expect(await buyNow({ publicId: 'HA-2026-TEST-0004', buyerUserId: other.id, buyerName: 'Outro', buyerEmail: 'outro@col.test', buyerDocument: null, paymentMethodId: oc.method.id, deliveryCep: null, insurance: false })).toMatchObject({ ok: false })
  }, 60_000)
})

describe('payout account and identity', () => {
  it('Pix key must be the holder CPF; identity sets CPF once', async () => {
    await prisma.user.update({ where: { id: s.b.userId }, data: { cpf: '52998224725' } })
    expect(await setPayoutAccount(s.b.memberId, s.b.tenantId, { type: 'CPF', key: '00000000191', holderName: 'B', holderDocument: '52998224725' })).toMatchObject({ ok: false })
    const r = await setPayoutAccount(s.b.memberId, s.b.tenantId, { type: 'CPF', key: '529.982.247-25', holderName: 'Bruna', holderDocument: '52998224725' })
    expect(r).toMatchObject({ ok: true, account: { pixKeyType: 'CPF', pixKeyMask: '***.982.247-**' } })
    const stored = await prisma.payoutAccount.findUniqueOrThrow({ where: { memberId: s.b.memberId } })
    expect(stored.pixKeyEnc).not.toContain('52998224725')
    expect(await payoutAccountOf(s.b.memberId)).toMatchObject({ pixKeyMask: '***.982.247-**' })
    expect(await setPayoutAccount(s.b.memberId, s.b.tenantId, { type: 'EMAIL', key: 'bruna@x.test', holderName: 'Bruna', holderDocument: null })).toMatchObject({ ok: true, account: { pixKeyType: 'EMAIL' } })

    expect(await identityOf(buyerId)).toMatchObject({ cpfMask: null, emailVerified: true, phoneVerified: false })
    expect(await setIdentity(buyerId, { cpf: '111' })).toMatchObject({ ok: false })
    expect(await setIdentity(buyerId, { cpf: '529.982.247-25' })).toMatchObject({ ok: false }) // taken by the seller
    const ok = await setIdentity(buyerId, { cpf: '111.444.777-35', city: 'Salvador' })
    expect(ok).toMatchObject({ ok: true, identity: { cpfMask: '***.444.777-**', city: 'Salvador' } })
    expect(await setIdentity(buyerId, { cpf: '00000000191' })).toMatchObject({ ok: false })
  }, 60_000)
})
