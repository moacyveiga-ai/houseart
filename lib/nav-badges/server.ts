// Menu badges — the counts (audit 2026-10-25, web-app §6): cheap, one query each, read by the
// panel layout on every page; a failure zeroes the badge and never blocks the page.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { memberFilter, type Scope } from '@/lib/scope/core'
import type { ProfileKind } from '@/lib/profiles/nav'
import { unreadMessages } from '@/lib/messaging/server'
import { isStuck, OPEN_STATUSES } from '@/lib/admin-transfers/core'
import { PAYABLE_PARTIES } from '@/lib/stripe/connect-core'
import { badgesFor, offerWaitsOnSeller, type BadgeCounts } from './core'

const quiet = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback)

/** Offers waiting on the seller (the desk's "Ofertas recebidas"). */
async function offersWaiting(scope: Scope, now: Date): Promise<number> {
  const rows = await prisma.offer.findMany({ where: { ...memberFilter(scope), status: { in: ['RECEIVED', 'NEGOTIATING'] }, expiresAt: { gt: now } }, select: { status: true, expiresAt: true, rounds: { orderBy: { number: 'desc' }, take: 1, select: { author: true } } }, take: 500 })
  return rows.filter((o) => offerWaitsOnSeller({ status: o.status, expiresAt: o.expiresAt, lastAuthor: o.rounds[0]?.author ?? null }, now)).length
}

/** The collector's purchases in course (buyer of a deal not completed nor cancelled). */
const purchasesInCourse = (userId: number) => prisma.deal.count({ where: { buyerUserId: userId, phase: { not: 'COMPLETED' }, exceptionStatus: null } })

/** The appraiser's queue: the requests they hold plus the free ones (any member's — the desk is house-wide, hence the total scope). */
const appraiserQueue = (userId: number) => totalScope('nav-badges:appraiser', () => prisma.appraisalRequest.count({ where: { status: { in: ['QUEUED', 'IN_PROGRESS'] }, OR: [{ assignedAppraiserId: userId }, { assignedAppraiserId: null }] } }))

async function staffCounts(now: Date): Promise<BadgeCounts> {
  return totalScope('nav-badges:staff', async () => {
    const [review, kyc, appraisals, owed, open] = await Promise.all([
      prisma.reviewQueueItem.count({ where: { status: 'OPEN' } }),
      prisma.kycVerification.count({ where: { status: 'PENDING' } }),
      prisma.appraisalRequest.count({ where: { status: { in: ['QUEUED', 'IN_PROGRESS'] }, assignedAppraiserId: null } }),
      // deals with a payable line released and not paid: the same rule as /admin/deals (isOwed), counted by deal
      prisma.dealSplit.findMany({ where: { status: 'RELEASED', party: { in: [...PAYABLE_PARTIES] } }, select: { dealId: true }, distinct: ['dealId'], take: 1000 }),
      prisma.ownershipTransfer.findMany({ where: { status: { in: [...OPEN_STATUSES] }, dealId: null }, select: { status: true, kycStatus: true, createdAt: true, sellerSignedAt: true, buyerSignedAt: true, feePaidAt: true }, take: 1000 }),
    ])
    return { review, kyc, appraisals, deals: owed.length, transfers: open.filter((t) => isStuck({ status: t.status, kycStatus: t.kycStatus, createdAt: t.createdAt.toISOString(), sellerSignedAt: t.sellerSignedAt?.toISOString() ?? null, buyerSignedAt: t.buyerSignedAt?.toISOString() ?? null, feePaidAt: t.feePaidAt?.toISOString() ?? null }, now)).length }
  })
}

/** All the badges of one person's active navigation profile, keyed by NAV item. */
export async function navBadges(profile: ProfileKind, user: { id: number }, scope: Scope, now = new Date()): Promise<Record<string, number>> {
  const c: BadgeCounts = {}
  if (profile !== 'appraiser' && profile !== 'admin') c.messages = await quiet(unreadMessages(user.id), 0)
  if (profile === 'artist') c.certification = await quiet(prisma.artwork.count({ where: { ...memberFilter(scope), status: 'IN_CERTIFICATION' } }), 0)
  if (profile === 'artist' || profile === 'gallery' || profile === 'advisor') c.sales = await quiet(offersWaiting(scope, now), 0)
  if (profile === 'collector') c.wallet = await quiet(purchasesInCourse(user.id), 0)
  if (profile === 'appraiser') c.appraisals = await quiet(appraiserQueue(user.id), 0)
  if (profile === 'admin') Object.assign(c, await quiet(staffCounts(now), {}))
  return badgesFor(profile, c)
}
