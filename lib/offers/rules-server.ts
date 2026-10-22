// The seller's offer rules (Phase 6) — I/O read by the offer flow; defaults when none.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { DEFAULT_RULES, type OfferRulesView } from './rules-core'

/**
 * The rules that apply to a seller. For a gallery team member they are the
 * gallery's (the latest row saved by anyone of the tenant), so the rules the
 * admin saves also hold for works registered by Vendas or Acervo.
 */
export async function rulesOfMember(memberId: number): Promise<OfferRulesView> {
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { kind: true, tenantId: true } })
  const r = m?.kind === 'GALLERY_STAFF' && m.tenantId
    ? await prisma.offerRules.findFirst({ where: { tenantId: m.tenantId }, orderBy: { updatedAt: 'desc' } })
    : await prisma.offerRules.findUnique({ where: { memberId } })
  return r ? { refuseLow: r.refuseLow, refuseBelowBps: r.refuseBelowBps, autoAcceptOn: r.autoAcceptOn, autoAcceptMinBps: r.autoAcceptMinBps, responseHours: r.responseHours, notifyTeam: r.notifyTeam } : DEFAULT_RULES
}
