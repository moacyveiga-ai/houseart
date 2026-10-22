// The seller's offer rules (Phase 6) — I/O read by the offer flow; defaults when none.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { DEFAULT_RULES, type OfferRulesView } from './rules-core'

export async function rulesOfMember(memberId: number): Promise<OfferRulesView> {
  const r = await prisma.offerRules.findUnique({ where: { memberId } })
  return r ? { refuseLow: r.refuseLow, refuseBelowBps: r.refuseBelowBps, autoAcceptOn: r.autoAcceptOn, autoAcceptMinBps: r.autoAcceptMinBps, responseHours: r.responseHours, notifyTeam: r.notifyTeam } : DEFAULT_RULES
}
