// Menu badges — the counts (audit 2026-10-25, web-app §6): cheap, read by the panel layout on
// every page, in parallel; a failure zeroes the badge and never blocks the page. Each number is
// the one the screen behind the item shows by default (its opening filter), so the menu and the
// page never disagree.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { memberFilter, type Scope } from '@/lib/scope/core'
import { ScopeNotApplied } from '@/lib/scope/extension-core'
import type { ProfileKind } from '@/lib/profiles/nav'
import { unreadMessages } from '@/lib/messaging/server'
import { OPEN_FOR_SELLER } from '@/lib/offers/domain'
import { OPEN_STATUSES } from '@/lib/admin-transfers/core'
import { PAYABLE_PARTIES } from '@/lib/stripe/connect-core'
import { badgesFor, offerWaitsOnSeller, type BadgeCounts } from './core'

/** Any error zeroes the badge — except the scope ratchet, which must keep hurting in dev/test. */
const quiet = <T,>(p: Promise<T>, fallback: T) => p.catch((e: unknown) => { if (e instanceof ScopeNotApplied) throw e; return fallback })

/** Offers waiting on the seller (the desk's "Ofertas recebidas"). Newest first; above the cap the count is a floor. */
const OFFERS_CAP = 500
async function offersWaiting(scope: Scope, now: Date): Promise<number> {
  const rows = await prisma.offer.findMany({ where: { ...memberFilter(scope), status: { in: [...OPEN_FOR_SELLER] }, expiresAt: { gt: now } }, orderBy: { id: 'desc' }, select: { status: true, expiresAt: true, rounds: { orderBy: { number: 'desc' }, take: 1, select: { author: true } } }, take: OFFERS_CAP })
  return rows.filter((o) => offerWaitsOnSeller({ status: o.status, expiresAt: o.expiresAt, lastAuthor: o.rounds[0]?.author ?? null }, now)).length
}

/** The collector's "Compras" of the collection header: deals in course as the buyer (`inCourseForBuyer`: a dispute is still in course, a cancelled deal is not) plus the collector's own open offers. */
async function purchasesInCourse(userId: number): Promise<number> {
  const [deals, offers] = await Promise.all([
    prisma.deal.count({ where: { buyerUserId: userId, phase: { not: 'COMPLETED' }, OR: [{ exceptionStatus: null }, { exceptionStatus: 'DISPUTE' }] } }),
    prisma.offer.count({ where: { buyerUserId: userId, status: { in: [...OPEN_FOR_SELLER] } } }),
  ])
  return deals + offers
}

/** The appraisals desk opens on "open": every request in the queue or in progress (also another appraiser's), for the appraiser and for the staff alike. */
// `await` INSIDE the scope: a PrismaPromise is lazy and would run after the total scope closed (the ratchet caught exactly this).
const openAppraisals = () => totalScope('nav-badges:appraisals', async () => await prisma.appraisalRequest.count({ where: { status: { in: ['QUEUED', 'IN_PROGRESS'] } } }))

async function staffCounts(): Promise<BadgeCounts> {
  return totalScope('nav-badges:staff', async () => {
    const [review, latestKyc, appraisals, owed, transfers] = await Promise.all([
      prisma.reviewQueueItem.count({ where: { status: 'OPEN' } }),
      // the KYC queue counts PEOPLE by their most recent verification (lib/admin-kyc), not rows: one person may hold several PENDING rows
      prisma.kycVerification.findMany({ orderBy: { id: 'desc' }, distinct: ['userId'], select: { status: true }, take: 2000 }),
      openAppraisals(),
      // deals with a payable line released and not paid: the same rule as /admin/deals (isOwed), counted by deal
      prisma.dealSplit.groupBy({ by: ['dealId'], where: { status: 'RELEASED', party: { in: [...PAYABLE_PARTIES] } } }),
      // /admin/transfers opens on "Em curso": every open transfer outside a deal
      prisma.ownershipTransfer.count({ where: { status: { in: [...OPEN_STATUSES] }, dealId: null } }),
    ])
    return { review, kyc: latestKyc.filter((v) => v.status === 'PENDING').length, appraisals, deals: owed.length, transfers }
  })
}

/** All the badges of one person's active navigation profile, keyed by NAV item. */
export async function navBadges(profile: ProfileKind, user: { id: number }, scope: Scope, now = new Date()): Promise<Record<string, number>> {
  const c: BadgeCounts = {}
  const jobs: Promise<void>[] = []
  const put = <K extends keyof BadgeCounts>(k: K, p: Promise<number>) => { jobs.push(quiet(p, 0).then((v) => { c[k] = v })) }
  if (profile !== 'appraiser' && profile !== 'admin') put('messages', unreadMessages(user.id))
  if (profile === 'artist') put('certification', prisma.artwork.count({ where: { ...memberFilter(scope), status: 'IN_CERTIFICATION' } }))
  if (profile === 'artist' || profile === 'gallery' || profile === 'advisor') put('sales', offersWaiting(scope, now))
  if (profile === 'collector') put('wallet', purchasesInCourse(user.id))
  if (profile === 'appraiser') put('appraisals', openAppraisals())
  if (profile === 'admin') jobs.push(quiet(staffCounts(), {}).then((s) => { Object.assign(c, s) }))
  await Promise.all(jobs)
  return badgesFor(profile, c)
}
