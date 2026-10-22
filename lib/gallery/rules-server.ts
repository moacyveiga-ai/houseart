// Gallery offer rules — I/O. One row per member (the gallery's seller identity);
// the tenant ADMIN edits it for the gallery. Applied by lib/offers at the offer.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { rulesProblems, type OfferRulesView } from '@/lib/offers/rules-core'
import { rulesOfMember } from '@/lib/offers/rules-server'
import { RULES_ROLES, requireSellerRole } from '@/lib/offers/seller-role-server'

function requireMember(scope: Scope): number {
  const memberId = memberOfScope(scope)
  if (!memberId) throw new ArtworkError('NO_MEMBER', 'Só quem vende tem regras de ofertas.', 403)
  return memberId
}

export async function rulesOf(scope: Scope): Promise<OfferRulesView> {
  const memberId = requireMember(scope)
  return rulesOfMember(memberId)
}

export async function saveRules(scope: Scope, input: Partial<OfferRulesView>, actor: { userId: number }): Promise<OfferRulesView> {
  const memberId = requireMember(scope)
  await requireSellerRole(scope, RULES_ROLES, 'Só o administrador da galeria muda as regras de ofertas.')
  const current = await rulesOf(scope)
  const next: OfferRulesView = { ...current, ...input }
  const problems = rulesProblems(next)
  if (problems.length) throw new ArtworkError('BAD_RULES', problems.join(' '), 400)
  await prisma.offerRules.upsert({ where: { memberId }, create: { memberId, tenantId: tenantOfScope(scope), ...next }, update: next })
  void audit.event({ entity: 'offer_rules', entityId: memberId, action: 'save', userId: actor.userId, after: next })
  return next
}

