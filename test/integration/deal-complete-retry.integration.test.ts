// The hourly retry of the deed (roteiro da noite, bloco 3): a deal whose buyer's
// tap was valid but whose completion failed afterwards stays in DELIVERY; the
// cron completes it once — never twice, not even with two runs at the same time —
// and leaves alone the deal without a tap, the one in exception and the tap that
// is still inside the grace window (the buyer's own request may be completing it).
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resumeStuckDeliveries } from '@/lib/deals/server'
import { computeSplit } from '@/lib/commission/split-core'
import { totalScope } from '@/lib/scope/context'
import { awaitDetached } from '@/lib/after'
import { POST as cronPOST } from '@/app/api/cron/deal-complete-retry/route'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

const ENV_KEYS = ['STRIPE_ENV', 'FLAG_DEALS', 'CRON_SECRET', 'VERCEL', 'VERCEL_ENV'] as const
const saved: Record<string, string | undefined> = {}
let s: Scenario
let buyerId: number
let seq = 0

beforeEach(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  delete process.env.VERCEL; delete process.env.VERCEL_ENV
  process.env.STRIPE_ENV = 'mock'; process.env.FLAG_DEALS = '1'; process.env.CRON_SECRET = 'cron-secret'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Notification', 'MarkerBatch', 'Certificate', 'OwnershipTransfer', 'JobRun', 'JobLease'])
  const buyer = await prisma.user.create({ data: { email: 'mariana@col.test', name: 'Mariana Barreto', profile: 'collector', active: true, emailVerifiedAt: new Date(), profiles: { create: { kind: 'COLLECTOR', isDefault: true } } } })
  buyerId = buyer.id
})

afterEach(async () => {
  await awaitDetached()
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
})

/** A deal stuck in DELIVERY: the tap was recorded (`tapped`) `minutesAgo` ago, the deed never came. */
function stuckDeal(opt: { artworkId: number; memberId: number; tapped?: boolean; minutesAgo?: number; exception?: string }) {
  return totalScope('test:fixture', async () => {
    seq++
    const amount = 4_400_000n
    const offer = await prisma.offer.create({ data: { code: `OFR-2026-R${seq}`, artworkId: opt.artworkId, sellerMemberId: opt.memberId, memberId: opt.memberId, buyerUserId: buyerId, buyerName: 'Mariana Barreto', buyerEmail: 'mariana@col.test', offeredCents: amount, acceptedCents: amount, status: 'IN_DEAL', expiresAt: new Date(Date.now() + 86_400_000) } })
    const lines = computeSplit({ amountCents: amount, market: 'PRIMARY', seller: 'ARTIST', galleryBps: 0, royaltyCents: 0n })
    const batch = await prisma.markerBatch.create({ data: { code: `BR-${seq}`, quantity: 1, destination: 'Teste' } })
    const marker = await prisma.physicalMarker.create({ data: { batchId: batch.id, uid: `04b1b2c3d4e5${String(seq).padStart(2, '0')}`, keyRef: 'k1', status: 'LINKED', artworkId: opt.artworkId, linkedAt: new Date(), readCounter: 2 } })
    const read = opt.tapped === false ? null : await prisma.markerRead.create({ data: { markerId: marker.id, counter: 2, cmacValid: true, purpose: 'DELIVERY_CONFIRM', userId: buyerId } })
    const deliveredAt = new Date(Date.now() - (opt.minutesAgo ?? 30) * 60_000)
    const deal = await prisma.deal.create({ data: {
      code: `DL-2026-R${seq}`, artworkId: opt.artworkId, offerId: offer.id, sellerMemberId: opt.memberId, memberId: opt.memberId, buyerUserId: buyerId, market: 'PRIMARY', amountCents: amount,
      phase: 'DELIVERY', escrowPaidAt: new Date(), sellerSignedAt: new Date(), buyerSignedAt: new Date(), shippedAt: new Date(),
      deliveredAt: read ? deliveredAt : null, deliveryMarkerReadId: read?.id ?? null, exceptionStatus: opt.exception ?? null,
      splits: { create: lines.map((l) => ({ party: l.party, bps: l.bps, amountCents: l.amountCents })) },
    } })
    const cert = await prisma.certificate.create({ data: { artworkId: opt.artworkId, publicId: `HA-2026-R-${seq}`, status: 'ACTIVE', stage: 5 } })
    const v = await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Vendedor', contentJson: JSON.stringify({ holder: { name: 'Vendedor' }, version: 1 }), contentHash: `hr${seq}`, status: 'ACTIVE' } })
    await prisma.certificate.update({ where: { id: cert.id }, data: { currentVersionId: v.id } })
    await prisma.artwork.update({ where: { id: opt.artworkId }, data: { status: 'IN_DEAL' } })
    return deal
  })
}

const cron = () => cronPOST(new NextRequest('http://test/api/cron/deal-complete-retry', { method: 'POST', headers: { authorization: 'Bearer cron-secret' } }))

describe('deal-complete-retry', () => {
  it('completes the stuck deal once: the deed goes to the buyer, the split is released, a second run writes nothing', async () => {
    const deal = await stuckDeal({ artworkId: s.b.artworkId, memberId: s.b.memberId })
    const res = await cron()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, found: 1, completed: 1, failed: 0 })
    const done = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id }, include: { splits: true } })
    expect(done.phase).toBe('COMPLETED')
    expect(done.splits.every((l) => l.status === 'RELEASED')).toBe(true)
    const versions = await prisma.certificateVersion.findMany({ where: { certificate: { artworkId: s.b.artworkId } }, orderBy: { version: 'asc' } })
    expect(versions.map((v) => [v.version, v.status, v.holderUserId])).toEqual([[1, 'SUPERSEDED', null], [2, 'ACTIVE', buyerId]])
    expect(await prisma.ownershipTransfer.count({ where: { dealId: deal.id } })).toBe(1)
    // next hour: nothing to do
    expect(await resumeStuckDeliveries()).toEqual({ found: 0, completed: 0, failed: 0 })
    // the route refuses without the cron secret
    expect((await cronPOST(new NextRequest('http://test/api/cron/deal-complete-retry', { method: 'POST' }))).status).toBe(401)
  })

  it('two runs at the same time complete it once (compare-and-swap on the phase)', async () => {
    const deal = await stuckDeal({ artworkId: s.b.artworkId, memberId: s.b.memberId })
    const [a, b] = await Promise.all([resumeStuckDeliveries(), resumeStuckDeliveries()])
    expect(a.completed + b.completed).toBe(1)
    expect(await prisma.certificateVersion.count({ where: { certificate: { artworkId: s.b.artworkId } } })).toBe(2)
    expect(await prisma.ownershipTransfer.count({ where: { dealId: deal.id } })).toBe(1)
    expect(await prisma.dealPhaseEvent.count({ where: { dealId: deal.id, phase: 'COMPLETED' } })).toBe(1)
  })

  it('leaves alone a deal without a tap, one in exception and a tap still inside the grace window', async () => {
    const noTap = await stuckDeal({ artworkId: s.b.artworkId, memberId: s.b.memberId, tapped: false })
    const disputed = await stuckDeal({ artworkId: s.a1.artworkId, memberId: s.a1.memberId, exception: 'DISPUTE' })
    expect(await resumeStuckDeliveries()).toEqual({ found: 0, completed: 0, failed: 0 })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: noTap.id } })).phase).toBe('DELIVERY')
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: disputed.id } })).phase).toBe('DELIVERY')
    await truncateTables(['Deal', 'Offer', 'Certificate', 'MarkerBatch'])
    const fresh = await stuckDeal({ artworkId: s.b.artworkId, memberId: s.b.memberId, minutesAgo: 2 })
    expect(await resumeStuckDeliveries()).toEqual({ found: 0, completed: 0, failed: 0 })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: fresh.id } })).phase).toBe('DELIVERY')
  })

  it('never completes a sale whose artwork was disputed or whose certificate was revoked after the tap', async () => {
    const deal = await stuckDeal({ artworkId: s.b.artworkId, memberId: s.b.memberId })
    // a contestation approved in between: certificate REVOKED, artwork DISPUTED (lib/admin-review)
    await prisma.certificate.updateMany({ where: { artworkId: s.b.artworkId }, data: { status: 'REVOKED' } })
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'DISPUTED' } })
    expect(await resumeStuckDeliveries()).toEqual({ found: 0, completed: 0, failed: 0 })
    const still = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id }, include: { splits: true } })
    expect(still.phase).toBe('DELIVERY')
    expect(still.splits.some((l) => l.status === 'RELEASED')).toBe(false)
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('DISPUTED')
    expect(await prisma.certificateVersion.count({ where: { certificate: { artworkId: s.b.artworkId } } })).toBe(1)
    expect(await prisma.ownershipTransfer.count({ where: { dealId: deal.id } })).toBe(0)
  })
})
