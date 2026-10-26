// Menu badges: each navigation profile gets the counts its menu shows — the artist's works in
// certification and the offers waiting on the seller, the collector's purchases in course, the
// appraiser's queue, the staff's review/KYC/free appraisals/owed payouts/stuck transfers.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { navBadges } from '@/lib/nav-badges/server'
import { scopeOfUser, type Scope } from '@/lib/scope/core'
import { withScope } from '@/lib/scope/context'
import type { ProfileKind } from '@/lib/profiles/nav'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => { s = await createScenario(); await truncateTables(['Offer', 'Deal', 'AppraisalRequest', 'KycVerification', 'OwnershipTransfer', 'Certificate', 'ReviewQueueItem']) })

const memberScope = (m: { userId: number; memberId: number }, tenantId: number) => scopeOfUser({ profile: 'member', memberId: m.memberId, tenantId, tenantRole: 'ADMIN' }, () => false)
const day = 86_400_000
// every call inside the scope context of a real page, so the Prisma extension watches the queries (a query without an owner throws here)
const badges = (profile: ProfileKind, user: { id: number }, scope: Scope) => withScope(scope, 'test', () => navBadges(profile, user, scope))

describe('nav badges', () => {
  it('artist: works in certification and offers waiting on the seller (received, below the reserve, buyer moved last; not the ones the seller answered, nor expired)', async () => {
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'IN_CERTIFICATION' } })
    const offer = (n: number, status: string, expiresAt = new Date(Date.now() + day)) => prisma.offer.create({ data: { code: `OFR-2026-00000${n}`, artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, memberId: s.b.memberId, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100_000n, status, expiresAt } })
    const rec = await offer(1, 'RECEIVED')
    await prisma.offerRound.create({ data: { offerId: rec.id, number: 1, author: 'BUYER', amountCents: 100_000n } })
    const below = await offer(6, 'BELOW_RESERVE')
    await prisma.offerRound.create({ data: { offerId: below.id, number: 1, author: 'BUYER', amountCents: 50_000n } })
    const neg = await offer(2, 'NEGOTIATING')
    await prisma.offerRound.createMany({ data: [{ offerId: neg.id, number: 1, author: 'BUYER', amountCents: 100_000n }, { offerId: neg.id, number: 2, author: 'SELLER', amountCents: 120_000n }] })
    const back = await offer(3, 'NEGOTIATING')
    await prisma.offerRound.createMany({ data: [{ offerId: back.id, number: 1, author: 'BUYER', amountCents: 100_000n }, { offerId: back.id, number: 2, author: 'SELLER', amountCents: 120_000n }, { offerId: back.id, number: 3, author: 'BUYER', amountCents: 110_000n }] })
    await offer(4, 'RECEIVED', new Date(Date.now() - 1))
    await offer(5, 'ACCEPTED')
    const scope = memberScope(s.b, s.b.tenantId)
    expect(await badges('artist', { id: s.b.userId }, scope)).toEqual({ certification: 1, sales: 3 })
    // another member's offers never count for the gallery's desk
    expect(await badges('gallery', { id: s.a1.userId }, memberScope(s.a1, s.galleryTenantId))).toEqual({})
  })

  it('collector: purchases in course; appraiser: the open queue; staff: review, KYC by person, open appraisals, owed payouts, open transfers', async () => {
    const buyer = await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Prado', profile: 'collector', active: true } })
    const o1 = await prisma.offer.create({ data: { code: 'OFR-2026-000011', artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, memberId: s.b.memberId, buyerUserId: buyer.id, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100n, status: 'IN_DEAL', expiresAt: new Date(Date.now() + day) } })
    const o2 = await prisma.offer.create({ data: { code: 'OFR-2026-000012', artworkId: s.a1.artworkId, sellerMemberId: s.a1.memberId, memberId: s.a1.memberId, buyerUserId: buyer.id, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100n, status: 'CONVERTED', expiresAt: new Date(Date.now() + day) } })
    const open = await prisma.deal.create({ data: { code: 'DL-2026-000001', artworkId: s.b.artworkId, offerId: o1.id, sellerMemberId: s.b.memberId, memberId: s.b.memberId, buyerUserId: buyer.id, market: 'PRIMARY', amountCents: 100n, phase: 'ESCROW' } })
    const done = await prisma.deal.create({ data: { code: 'DL-2026-000002', artworkId: s.a1.artworkId, offerId: o2.id, sellerMemberId: s.a1.memberId, memberId: s.a1.memberId, buyerUserId: buyer.id, market: 'PRIMARY', amountCents: 100n, phase: 'COMPLETED' } })
    const none = scopeOfUser(null, () => false)
    expect(await badges('collector', { id: buyer.id }, none)).toEqual({ wallet: 1 })
    await prisma.deal.update({ where: { id: open.id }, data: { exceptionStatus: 'CANCELLED' } })
    expect(await badges('collector', { id: buyer.id }, none)).toEqual({})
    await prisma.deal.update({ where: { id: open.id }, data: { exceptionStatus: 'DISPUTE' } }) // a dispute is still in course
    await prisma.offer.create({ data: { code: 'OFR-2026-000013', artworkId: s.a2.artworkId, sellerMemberId: s.a2.memberId, memberId: s.a2.memberId, buyerUserId: buyer.id, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100n, status: 'NEGOTIATING', expiresAt: new Date(Date.now() + day) } }) // the collector's own open offer
    expect(await badges('collector', { id: buyer.id }, none)).toEqual({ wallet: 2 })
    await prisma.deal.update({ where: { id: open.id }, data: { exceptionStatus: null } })
    // owed payout lines: a payable RELEASED line counts (by deal); the house's line never does
    await prisma.dealSplit.createMany({ data: [
      { dealId: done.id, party: 'ARTIST', bps: 8000, amountCents: 80n, status: 'RELEASED' },
      { dealId: done.id, party: 'PLATFORM', bps: 2000, amountCents: 20n, status: 'RELEASED' },
      { dealId: open.id, party: 'PLATFORM', bps: 2000, amountCents: 20n, status: 'RELEASED' },
    ] })
    const appraiser = await prisma.user.create({ data: { email: 'av@houseart.test', name: 'Avaliadora', profile: 'appraiser', active: true } })
    const other = await prisma.user.create({ data: { email: 'av2@houseart.test', name: 'Outro', profile: 'appraiser', active: true } })
    await prisma.appraisalRequest.createMany({ data: [
      { artworkId: s.b.artworkId, requestedByUserId: s.b.userId, requesterLabel: 'Artista', purpose: 'SALE', dueOn: new Date(Date.now() + 7 * day), status: 'QUEUED', assignedAppraiserId: null },
      { artworkId: s.b.artworkId, requestedByUserId: s.b.userId, requesterLabel: 'Artista', purpose: 'SALE', dueOn: new Date(Date.now() + 7 * day), status: 'IN_PROGRESS', assignedAppraiserId: appraiser.id },
      { artworkId: s.b.artworkId, requestedByUserId: s.b.userId, requesterLabel: 'Artista', purpose: 'SALE', dueOn: new Date(Date.now() + 7 * day), status: 'QUEUED', assignedAppraiserId: other.id },
      { artworkId: s.b.artworkId, requestedByUserId: s.b.userId, requesterLabel: 'Artista', purpose: 'SALE', dueOn: new Date(Date.now() + 7 * day), status: 'ISSUED', assignedAppraiserId: null },
    ] })
    expect(await badges('appraiser', { id: appraiser.id }, scopeOfUser(null, () => false))).toEqual({ appraisals: 3 }) // the desk opens on every open request
    await prisma.kycVerification.createMany({ data: [{ userId: buyer.id, provider: 'didit', status: 'PENDING' }, { userId: buyer.id, provider: 'didit', status: 'PENDING' }, { userId: s.b.userId, provider: 'mock', status: 'PENDING' }, { userId: s.b.userId, provider: 'mock', status: 'APPROVED' }] }) // people, not rows: the buyer twice, Joana's latest is approved
    await prisma.reviewQueueItem.create({ data: { kind: 'CONTESTATION', status: 'OPEN', artworkId: s.b.artworkId, reason: 'teste' } })
    const cert = await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-NB-1', status: 'ACTIVE', stage: 5 } })
    const transfer = (status: string, createdAt: Date) => prisma.ownershipTransfer.create({ data: { certificateId: cert.id, artworkId: s.b.artworkId, fromUserId: s.b.userId, toName: 'Lia', toEmail: 'lia@col.test', toDocumentHash: 'h'.repeat(64), status, inviteTokenHash: `t${status}${createdAt.getTime()}`, createdAt } })
    await transfer('INVITED', new Date(Date.now() - 10 * day)) // stuck
    await transfer('INVITED', new Date()) // fresh
    await transfer('COMPLETED', new Date(Date.now() - 30 * day))
    expect(await badges('admin', { id: s.staff.userId }, scopeOfUser({ profile: 'admin', memberId: null, tenantId: null, tenantRole: null }, () => true))).toEqual({ review: 1, kyc: 1, deals: 1, transfers: 2, appraisals: 3 })
  })
})
