import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberFilter, type Scope } from '@/lib/scope/core'
import { diaNoFuso, startOfYearInTz } from '@/lib/timezone'
import type { DashboardCounts } from './core'

export async function dashboardCounts(scope: Scope, now = new Date()): Promise<DashboardCounts> {
  const where = { ...memberFilter(scope) }
  const yearStart = startOfYearInTz(now)
  const [authenticated, listed, inventory, sold, awaitingSignature, drafts] = await Promise.all([
    prisma.artwork.count({ where: { ...where, status: { in: ['AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD'] } } }),
    prisma.artwork.count({ where: { ...where, status: { in: ['LISTED', 'IN_DEAL'] } } }),
    prisma.artwork.count({ where: { ...where, status: { notIn: ['ARCHIVED', 'SOLD'] } } }),
    // "Vendidas em {ano}" = the deals COMPLETED this year with this member as seller (the same source as the
    // chart): a sold work leaves the seller's scope and becomes the buyer's AUTHENTICATED, never SOLD here
    prisma.deal.aggregate({ where: { ...where, phase: 'COMPLETED', completedAt: { gte: yearStart } }, _count: { _all: true }, _sum: { amountCents: true } }),
    prisma.artwork.count({ where: { ...where, certificate: { is: { stage: 3 } } } }),
    prisma.artwork.findMany({ where: { ...where, status: 'DRAFT' }, select: { media: { select: { kind: true } } } }),
  ])
  const pendingMedia = drafts.filter((d) => !d.media.some((m) => m.kind === 'FRONT_COLOR_CARD') || !d.media.some((m) => m.kind === 'BACK')).length
  return {
    authenticated, listed, inventory, consigned: 0, openOffers: 0, royaltyCents: 0n,
    soldThisYear: sold._count._all, soldThisYearCents: sold._sum.amountCents ?? 0n,
    awaitingSignature, pendingMedia, markersToLink: 0,
  }
}

/** Deals completed this year in the scope (the seller's side), as the chart's rows: the day of completion in the house timezone and the price. */
export async function salesThisYear(scope: Scope, now = new Date()): Promise<{ day: string; amountCents: bigint }[]> {
  const rows = await prisma.deal.findMany({
    where: { ...memberFilter(scope), phase: 'COMPLETED', completedAt: { gte: startOfYearInTz(now) } },
    select: { completedAt: true, amountCents: true }, orderBy: { completedAt: 'asc' }, take: 500,
  })
  return rows.flatMap((r) => { const day = diaNoFuso(r.completedAt); return day ? [{ day, amountCents: r.amountCents }] : [] })
}
