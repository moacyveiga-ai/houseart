// Stripe Connect against the in-memory fake (never the real API): one Express
// account per member (idempotent), the onboarding link, the account.updated
// webhook (own signing secret), the payout of the split when the deal completes
// (seller + royalty by Transfer when ENABLED; RELEASED when not; the cron pays
// later; a retry never double-transfers; platform/shipping/insurance lines never
// move), a reversed transfer, and mock mode untouched.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { confirmDelivery, retryDealPayout } from '@/lib/deals/server'
import { connectAccountView, connectDashboardLink, ensureConnectAccount, payReleasedSplits, startOnboarding, syncConnectAccount } from '@/lib/stripe/connect-server'
import { setStripeGatewayForTests } from '@/lib/stripe/gateway-server'
import { signStripePayload } from '@/lib/stripe/mode-core'
import { computeSplit } from '@/lib/commission/split-core'
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route'
import { POST as startPOST } from '@/app/api/sales/connect/start/route'
import { POST as cronPOST } from '@/app/api/cron/connect-payouts/route'
import { POST as paidPOST } from '@/app/api/admin/deals/[id]/splits/[splitId]/paid/route'
import { adminDeals } from '@/lib/admin-deals/server'
import { NextRequest } from 'next/server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { totalScope } from '@/lib/scope/context'
import { truncateTables } from './db'
import { FakeStripe } from './fake-stripe'

const ENV_KEYS = ['STRIPE_ENV', 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'FLAG_DEALS', 'FLAG_RESALE_ROYALTY', 'MARKER_VENDOR', 'APP_URL', 'CRON_SECRET', 'VERCEL', 'VERCEL_ENV'] as const
const saved: Record<string, string | undefined> = {}
const WHSEC = 'whsec_test_platform'
const WHSEC_CONNECT = 'whsec_test_connect'

let s: Scenario
let fake: FakeStripe
let buyerId: number

beforeEach(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  delete process.env.VERCEL; delete process.env.VERCEL_ENV
  process.env.STRIPE_ENV = 'test'; process.env.STRIPE_SECRET_KEY = 'sk_test_fake'; process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake'
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC; process.env.STRIPE_CONNECT_WEBHOOK_SECRET = WHSEC_CONNECT
  process.env.FLAG_DEALS = '1'; process.env.FLAG_RESALE_ROYALTY = '1'; process.env.MARKER_VENDOR = 'mock'; process.env.APP_URL = 'https://houseart.test'; process.env.CRON_SECRET = 'cron-secret'
  fake = new FakeStripe()
  setStripeGatewayForTests(fake)
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Notification', 'StripeEvent', 'StripeConnectAccount', 'MarkerBatch', 'Certificate', 'OwnershipTransfer', 'RoyaltyPayment'])
  const buyer = await prisma.user.create({ data: { email: 'mariana@col.test', name: 'Mariana Barreto', profile: 'collector', active: true, emailVerifiedAt: new Date(), profiles: { create: { kind: 'COLLECTOR', isDefault: true } } } })
  buyerId = buyer.id
})

afterEach(() => {
  signOut()
  setStripeGatewayForTests(null)
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
})

/** A deal in SHIPPING with its split, a linked tag and an active certificate — ready for the buyer's tap. */
function dealReadyForDelivery(opt: { artworkId: number; sellerMemberId: number; market: 'PRIMARY' | 'SECONDARY'; seller: 'ARTIST' | 'GALLERY'; royaltyCents?: bigint; galleryBps?: number; artistId?: number }) {
  // the fixture writes the whole base on purpose (a route test may have left a scoped context behind)
  return totalScope('test:fixture', () => buildDeal(opt))
}
async function buildDeal(opt: { artworkId: number; sellerMemberId: number; market: 'PRIMARY' | 'SECONDARY'; seller: 'ARTIST' | 'GALLERY'; royaltyCents?: bigint; galleryBps?: number; artistId?: number }) {
  const amount = 4_400_000n
  const seq = await prisma.deal.count() + 1
  const offer = await prisma.offer.create({ data: { code: `OFR-2026-${String(seq).padStart(6, '0')}`, artworkId: opt.artworkId, sellerMemberId: opt.sellerMemberId, memberId: opt.sellerMemberId, buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', offeredCents: amount, acceptedCents: amount, status: 'IN_DEAL', expiresAt: new Date(Date.now() + 86_400_000) } })
  const lines = computeSplit({ amountCents: amount, market: opt.market, seller: opt.seller, galleryBps: opt.galleryBps ?? 0, royaltyCents: opt.royaltyCents ?? 0n })
  const deal = await prisma.deal.create({ data: {
    code: `DL-2026-${String(seq).padStart(6, '0')}`, artworkId: opt.artworkId, offerId: offer.id, sellerMemberId: opt.sellerMemberId, memberId: opt.sellerMemberId, buyerUserId: buyerId, market: opt.market, amountCents: amount,
    phase: 'SHIPPING', escrowPaidAt: new Date(), escrowPaymentRef: 'pi_fake_escrow', sellerSignedAt: new Date(), buyerSignedAt: new Date(), carrierName: 'ArtTrans', trackingCode: 'AT-1', shippedAt: new Date(),
    splits: { create: [...lines.map((l) => ({ party: l.party, bps: l.bps, amountCents: l.amountCents })), { party: 'SHIPPING', bps: 0, amountCents: 85_000n }] },
  } })
  if (opt.royaltyCents && opt.artistId) await prisma.royaltyPayment.create({ data: { artworkId: opt.artworkId, artistId: opt.artistId, dealId: deal.id, saleCents: amount, previousSaleCents: amount - opt.royaltyCents * 20n, appreciationCents: opt.royaltyCents * 20n, royaltyCents: opt.royaltyCents, status: 'HELD' } })
  const batch = await prisma.markerBatch.create({ data: { code: `B-${seq}`, quantity: 1, destination: 'Teste' } })
  await prisma.physicalMarker.create({ data: { batchId: batch.id, uid: `04a1b2c3d4e5${String(seq).padStart(2, '0')}`, keyRef: 'k1', status: 'LINKED', artworkId: opt.artworkId, linkedAt: new Date(), readCounter: 1 } })
  const cert = await prisma.certificate.create({ data: { artworkId: opt.artworkId, publicId: `HA-2026-T-${seq}`, status: 'ACTIVE', stage: 5 } })
  const v = await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Vendedor', contentJson: JSON.stringify({ holder: { name: 'Vendedor' }, version: 1 }), contentHash: `h${seq}`, status: 'ACTIVE' } })
  await prisma.certificate.update({ where: { id: cert.id }, data: { currentVersionId: v.id } })
  return deal
}

async function enableAccount(memberId: number) {
  const row = await ensureConnectAccount(memberId)
  fake.completeOnboarding(row.accountId)
  await syncConnectAccount(memberId)
  return row.accountId
}

const splitsOf = (dealId: number) => prisma.dealSplit.findMany({ where: { dealId }, orderBy: { id: 'asc' } })

function webhook(body: string, secret: string) {
  return webhookPOST(new Request('http://test/api/stripe/webhook', { method: 'POST', body, headers: { 'stripe-signature': signStripePayload(body, secret, Math.floor(Date.now() / 1000)) } }))
}

describe('onboarding', () => {
  it('creates ONE Express account per member and mode (idempotent), the link under APP_URL, and the status walks PENDING → ONBOARDING → ENABLED', async () => {
    expect(await connectAccountView(s.b.memberId)).toMatchObject({ status: 'PENDING', statusLabel: 'Não conectado', mode: 'test' })
    const { url } = await startOnboarding(s.b.memberId)
    expect(url).toMatch(/^https:\/\/connect\.stripe\.com\//)
    await startOnboarding(s.b.memberId)
    expect(fake.accounts.size).toBe(1)
    expect(fake.calls.filter((c) => c.op === 'account')).toHaveLength(1) // the row answers the second call: no call to Stripe
    const link = fake.calls.find((c) => c.op === 'account_link')!.params as { refresh_url: string; return_url: string }
    expect(link).toMatchObject({ refresh_url: 'https://houseart.test/sales/payout?connect=refresh', return_url: 'https://houseart.test/sales/payout?connect=return' })
    const [acct] = [...fake.accounts.values()]
    expect(acct.business_type).toBe('individual'); expect(acct.email).toBe('b@artista.test')
    const row = await prisma.stripeConnectAccount.findUniqueOrThrow({ where: { memberId: s.b.memberId } })
    expect(row).toMatchObject({ accountId: acct.id, mode: 'test', status: 'ONBOARDING' })
    // before Stripe verifies: RESTRICTED with the pt-BR list; the dashboard refuses
    fake.completeOnboarding(acct.id, false)
    expect(await syncConnectAccount(s.b.memberId)).toMatchObject({ status: 'RESTRICTED', statusLabel: 'Pendências', requirements: ['Documento de identidade (foto)'] })
    await expect(connectDashboardLink(s.b.memberId)).rejects.toMatchObject({ code: 'CONNECT_NOT_ENABLED' })
    fake.completeOnboarding(acct.id)
    expect(await syncConnectAccount(s.b.memberId)).toMatchObject({ status: 'ENABLED', statusLabel: 'Ativa', payoutsEnabled: true, requirements: [] })
    expect((await connectDashboardLink(s.b.memberId)).url).toContain(acct.id)
    // a gallery's account is a company
    await ensureConnectAccount(s.a1.memberId)
    expect([...fake.accounts.values()][1].business_type).toBe('company')
  })

  it('the route: only a member sells; in a gallery team only the ADMIN connects', async () => {
    await signIn(s.a2.userId) // advisor, MEMBER of the gallery tenant → member scope: their own account
    expect((await startPOST()).status).toBe(200)
    signOut()
    await signIn(buyerId) // a collector without a member
    expect((await startPOST()).status).toBe(403)
  })

  it('a row of the other mode is replaced (the test account means nothing live)', async () => {
    const first = await ensureConnectAccount(s.b.memberId)
    process.env.STRIPE_ENV = 'live'; process.env.STRIPE_SECRET_KEY = 'sk_live_fake'
    const second = await ensureConnectAccount(s.b.memberId)
    expect(second.id).toBe(first.id); expect(second.accountId).not.toBe(first.accountId); expect(second.mode).toBe('live')
    expect(await prisma.stripeConnectAccount.count()).toBe(1)
  })
})

describe('webhook account.updated', () => {
  it('flips the status from the event object, signed with the Connect endpoint secret; a repeated event is a duplicate; an unknown account is ignored', async () => {
    const row = await ensureConnectAccount(s.b.memberId)
    fake.completeOnboarding(row.accountId)
    const body = JSON.stringify({ id: 'evt_acct_1', type: 'account.updated', livemode: false, account: row.accountId, data: { object: fake.accountEventObject(row.accountId) } })
    expect((await webhook(body, WHSEC_CONNECT)).status).toBe(200)
    expect((await prisma.stripeConnectAccount.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ENABLED')
    expect(await (await webhook(body, WHSEC_CONNECT)).json()).toMatchObject({ duplicate: true })
    // the platform secret also verifies (the same URL serves both endpoints)
    const body2 = JSON.stringify({ id: 'evt_acct_2', type: 'account.updated', livemode: false, data: { object: { object: 'account', id: 'acct_unknown', details_submitted: true } } })
    expect((await webhook(body2, WHSEC)).status).toBe(200)
    // a live event in test mode is ignored
    const body3 = JSON.stringify({ id: 'evt_acct_3', type: 'account.updated', livemode: true, data: { object: fake.accountEventObject(row.accountId) } })
    expect(await (await webhook(body3, WHSEC)).json()).toMatchObject({ ignored: 'mode' })
    expect((await webhook(body, 'whsec_wrong')).status).toBe(400)
  })
})

describe('payout at completion', () => {
  it('pays the artist seller by Transfer when ENABLED; the platform and shipping lines never move; a re-run is idempotent', async () => {
    const acct = await enableAccount(s.b.memberId)
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    await confirmDelivery(buyerId, deal.id, null)
    const lines = await splitsOf(deal.id)
    const artist = lines.find((l) => l.party === 'ARTIST')!
    expect(artist).toMatchObject({ status: 'PAID', amountCents: 3_872_000n, payoutError: null })
    expect(artist.payoutRef).toMatch(/^tr_/); expect(artist.transferredAt).not.toBeNull()
    expect(lines.find((l) => l.party === 'PLATFORM')).toMatchObject({ status: 'RELEASED', payoutRef: null })
    expect(lines.find((l) => l.party === 'SHIPPING')).toMatchObject({ status: 'RELEASED', payoutRef: null })
    const transfers = [...fake.transfers.values()]
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({ amount: 3_872_000, destination: acct, transfer_group: deal.code })
    expect(fake.calls.find((c) => c.op === 'transfer')!.key).toBe(`deal-split:${artist.id}`)
    // the deal itself completed as always
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).phase).toBe('COMPLETED')
    // retry and the cron find nothing to pay and create no second transfer
    expect(await retryDealPayout(deal.id)).toEqual({ paid: 0, skipped: 0, failed: 0 })
    expect(await payReleasedSplits()).toEqual({ paid: 0, skipped: 0, failed: 0 })
    expect(fake.transfers.size).toBe(1)
  })

  it('a Transfer that Stripe already made for the line (the write failed after it) is reused by its metadata, never duplicated', async () => {
    const acct = await enableAccount(s.b.memberId)
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    const artist = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    // what the previous run left at Stripe before our database refused the write
    fake.transfers.set('tr_left_behind', { id: 'tr_left_behind', amount: 3_872_000, destination: acct, transfer_group: deal.code, reversed: false, amount_reversed: 0, metadata: { dealSplitId: String(artist.id) } })
    await confirmDelivery(buyerId, deal.id, null)
    const paid = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    expect(paid).toMatchObject({ status: 'PAID', payoutRef: 'tr_left_behind', payoutError: null, payoutAttempts: 0 })
    expect(fake.transfers.size).toBe(1)
    expect(fake.calls.filter((c) => c.op === 'transfer')).toHaveLength(0)
    expect(fake.calls.filter((c) => c.op === 'transfers_list')).toHaveLength(1)
  })

  it('a seller without an ENABLED account stays RELEASED (manual Pix); after onboarding the cron pays — and a Stripe refusal is written on the line and retried', async () => {
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    await confirmDelivery(buyerId, deal.id, null)
    expect((await splitsOf(deal.id)).map((l) => l.status)).toEqual(['RELEASED', 'RELEASED', 'RELEASED'])
    expect(fake.transfers.size).toBe(0)
    // the account exists but is not verified yet: still nothing
    const row = await ensureConnectAccount(s.b.memberId)
    fake.completeOnboarding(row.accountId, false); await syncConnectAccount(s.b.memberId)
    expect(await payReleasedSplits()).toEqual({ paid: 0, skipped: 1, failed: 0 })
    // verified, but the platform balance is short: the error stays on the line, nothing is lost
    fake.completeOnboarding(row.accountId); await syncConnectAccount(s.b.memberId)
    fake.transferFailure = { type: 'StripeInvalidRequestError', code: 'balance_insufficient' }
    expect(await payReleasedSplits()).toEqual({ paid: 0, skipped: 0, failed: 1 })
    const failed = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    expect(failed).toMatchObject({ status: 'RELEASED', payoutError: 'balance_insufficient', payoutRef: null, payoutAttempts: 1 })
    // the cron route pays on the next hour under a NEW key (Stripe would replay the saved failure under the old one for 24 h)
    fake.transferFailure = null
    const res = await cronPOST(new NextRequest('http://test/api/cron/connect-payouts', { method: 'POST', headers: { authorization: 'Bearer cron-secret' } }))
    expect(await res.json()).toMatchObject({ ok: true, paid: 1, failed: 0 })
    const paid = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    expect(paid).toMatchObject({ status: 'PAID', payoutError: null, payoutAttempts: 1 })
    expect(paid.payoutRef).toMatch(/^tr_/)
    expect(fake.transfers.size).toBe(1)
    expect(fake.calls.filter((c) => c.op === 'transfer').map((c) => c.key)).toEqual([`deal-split:${paid.id}`, `deal-split:${paid.id}:r1`])
  })

  it('gallery sale: the gallery line goes to the ADMIN account of the tenant, the artist line and the royalty to the artist member, both ENABLED', async () => {
    // the gallery's artwork is by an artist WITH an account: use the autonomous artist b as the artist of a1's artwork
    const artistB = await prisma.artist.findUniqueOrThrow({ where: { memberId: s.b.memberId } })
    await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { artistId: artistB.id, market: 'SECONDARY' } })
    const galleryAcct = await enableAccount(s.a1.memberId)
    const artistAcct = await enableAccount(s.b.memberId)
    const deal = await dealReadyForDelivery({ artworkId: s.a1.artworkId, sellerMemberId: s.a1.memberId, market: 'SECONDARY', seller: 'GALLERY', galleryBps: 4614, royaltyCents: 27_500n, artistId: artistB.id })
    await confirmDelivery(buyerId, deal.id, null)
    const lines = await splitsOf(deal.id)
    const by = (p: string) => lines.find((l) => l.party === p)!
    expect(by('GALLERY').status).toBe('PAID'); expect(by('ARTIST').status).toBe('PAID'); expect(by('ARTIST_ROYALTY').status).toBe('PAID')
    expect(by('PLATFORM').status).toBe('RELEASED')
    const t = [...fake.transfers.values()]
    expect(t.map((x) => x.destination).sort()).toEqual([galleryAcct, artistAcct, artistAcct].sort())
    expect(t.reduce((a, x) => a + x.amount, 0)).toBe(Number(by('GALLERY').amountCents + by('ARTIST').amountCents + by('ARTIST_ROYALTY').amountCents))
    expect((await prisma.royaltyPayment.findUniqueOrThrow({ where: { dealId: deal.id } })).status).toBe('PAID')
    // the seller's view says it
    const { sellerDeals } = await import('@/lib/deals/server')
    const { asPanel } = await import('./session')
    await asPanel(s.a1.userId, async ({ scope }) => {
      const [v] = await sellerDeals(scope)
      expect(v.split.map((l) => [l.party, l.payoutState])).toEqual(expect.arrayContaining([['GALLERY', 'STRIPE_PAID'], ['ARTIST', 'STRIPE_PAID'], ['ARTIST_ROYALTY', 'STRIPE_PAID'], ['PLATFORM', 'PLATFORM']]))
    })
  })

  it('a gallery sale whose artist has no account: the gallery is paid, the artist line stays RELEASED (manual) and says so', async () => {
    await enableAccount(s.a1.memberId)
    const deal = await dealReadyForDelivery({ artworkId: s.a1.artworkId, sellerMemberId: s.a1.memberId, market: 'PRIMARY', seller: 'GALLERY', galleryBps: 4614 })
    await confirmDelivery(buyerId, deal.id, null)
    const lines = await splitsOf(deal.id)
    expect(lines.find((l) => l.party === 'GALLERY')!.status).toBe('PAID')
    expect(lines.find((l) => l.party === 'ARTIST')).toMatchObject({ status: 'RELEASED', payoutRef: null, payoutError: null })
    const { sellerDeals } = await import('@/lib/deals/server')
    const { asPanel } = await import('./session')
    await asPanel(s.a1.userId, async ({ scope }) => {
      const [v] = await sellerDeals(scope)
      expect(v.split.find((l) => l.party === 'ARTIST')).toMatchObject({ payoutState: 'MANUAL', payoutLabel: 'liberado · repasse manual por Pix' })
    })
  })

  it('transfer.reversed puts the line back to RELEASED with the reason and the cron does NOT transfer again by itself', async () => {
    await enableAccount(s.b.memberId)
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    await confirmDelivery(buyerId, deal.id, null)
    const line = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    const body = JSON.stringify({ id: 'evt_tr_1', type: 'transfer.reversed', livemode: false, data: { object: { object: 'transfer', id: line.payoutRef, reversed: true, amount_reversed: Number(line.amountCents) } } })
    expect((await webhook(body, WHSEC)).status).toBe(200)
    expect(await prisma.dealSplit.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ status: 'RELEASED', payoutError: 'transfer_reversed', payoutRef: line.payoutRef, transferredAt: null })
    expect(await payReleasedSplits()).toEqual({ paid: 0, skipped: 0, failed: 0 })
    expect(fake.transfers.size).toBe(1)
  })
})

describe('mock mode', () => {
  it('Connect refuses with 409 and the completion leaves the split RELEASED exactly as before', async () => {
    delete process.env.STRIPE_SECRET_KEY; process.env.STRIPE_ENV = 'mock'
    await expect(startOnboarding(s.b.memberId)).rejects.toMatchObject({ code: 'STRIPE_MOCK', status: 409 })
    await expect(syncConnectAccount(s.b.memberId)).rejects.toMatchObject({ status: 409 })
    expect(await connectAccountView(s.b.memberId)).toMatchObject({ status: 'PENDING', mode: 'mock' })
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    await confirmDelivery(buyerId, deal.id, null)
    expect((await splitsOf(deal.id)).every((l) => l.status === 'RELEASED' && l.payoutRef === null)).toBe(true)
    expect(await payReleasedSplits()).toEqual({ paid: 0, skipped: 0, failed: 0 })
    expect(fake.calls).toHaveLength(0)
  })
})

describe('Admin › Negócios: the desk marks a manual Pix as paid', () => {
  const paid = (dealId: number, splitId: number, note: unknown) => paidPOST(new Request(`http://test/api/admin/deals/${dealId}/splits/${splitId}/paid`, { method: 'POST', body: JSON.stringify({ note }), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(dealId), splitId: String(splitId) }) })

  it('only the team; a RELEASED line without a Stripe transfer becomes PAID with the note, the royalty settles, a transferred or held line is refused', async () => {
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'SECONDARY', seller: 'ARTIST', royaltyCents: 10_000n, artistId: (await prisma.artist.findFirstOrThrow({ where: { memberId: s.b.memberId } })).id })
    const held = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    // before the completion: HELD, nothing to mark; the seller is not the desk
    await signIn(s.b.userId)
    expect((await paid(deal.id, held.id, 'Pix')).status).toBe(403)
    signOut(); await signIn(s.staff.userId)
    expect((await paid(deal.id, held.id, 'Pix')).status).toBe(409)
    await confirmDelivery(buyerId, deal.id, null)
    const rows = await adminDeals()
    const row = rows.find((r) => r.id === deal.id)!
    expect(row.phase).toBe('COMPLETED')
    expect(row.splits.find((l) => l.party === 'ARTIST')).toMatchObject({ status: 'RELEASED', payoutState: 'MANUAL', payee: 'Joana Teixeira' })
    expect(row.splits.find((l) => l.party === 'PLATFORM')).toMatchObject({ payoutState: 'PLATFORM', payee: null })
    expect((await paid(deal.id, held.id, '   ')).status).toBe(422)
    const res = await paid(deal.id, held.id, 'Pix 26/10 · comprovante 77')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, amount: expect.stringContaining('R$') })
    const after = await prisma.dealSplit.findUniqueOrThrow({ where: { id: held.id } })
    expect(after).toMatchObject({ status: 'PAID', payoutRef: 'manual:Pix 26/10 · comprovante 77', payoutError: null })
    expect(after.transferredAt).not.toBeNull()
    // twice is a conflict; the platform line is never manual; the royalty line settles its payment
    expect((await paid(deal.id, held.id, 'de novo')).status).toBe(409)
    const platform = (await splitsOf(deal.id)).find((l) => l.party === 'PLATFORM')!
    expect((await paid(deal.id, platform.id, 'x')).status).toBe(409)
    const royalty = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST_ROYALTY')!
    expect((await paid(deal.id, royalty.id, 'Pix royalty')).status).toBe(200)
    expect((await prisma.royaltyPayment.findFirstOrThrow({ where: { dealId: deal.id } })).status).toBe('PAID')
    expect((await adminDeals()).find((r) => r.id === deal.id)!.splits.find((l) => l.party === 'ARTIST')).toMatchObject({ status: 'PAID', payoutState: 'MANUAL_PAID', payoutLabel: 'pago por Pix · Pix 26/10 · comprovante 77' })
    // a line of another deal under this deal's id is not found
    expect((await paid(deal.id + 1, held.id, 'x')).status).toBe(404)
  })

  it('a line the Stripe pays alone (ENABLED account, even after a refusal) is never marked by hand; the house lines are never "to pay"', async () => {
    const deal = await dealReadyForDelivery({ artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, market: 'PRIMARY', seller: 'ARTIST' })
    await enableAccount(s.b.memberId)
    fake.transferFailure = { type: 'StripeInvalidRequestError', code: 'balance_insufficient' }
    await confirmDelivery(buyerId, deal.id, null)
    const line = (await splitsOf(deal.id)).find((l) => l.party === 'ARTIST')!
    expect(line).toMatchObject({ status: 'RELEASED', payoutError: 'balance_insufficient' })
    await signIn(s.staff.userId)
    const row = (await adminDeals()).find((r) => r.id === deal.id)!
    expect(row.splits.find((l) => l.party === 'ARTIST')).toMatchObject({ payoutState: 'FAILED', stripePays: true })
    expect(row.splits.find((l) => l.party === 'PLATFORM')).toMatchObject({ status: 'RELEASED', stripePays: false })
    const res = await paid(deal.id, line.id, 'Pix à mão')
    expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ code: 'STRIPE_PAYS' })
    fake.transferFailure = null
    expect(await retryDealPayout(deal.id)).toMatchObject({ paid: 1 })
    expect((await prisma.dealSplit.findUniqueOrThrow({ where: { id: line.id } })).status).toBe('PAID')
  })
})
