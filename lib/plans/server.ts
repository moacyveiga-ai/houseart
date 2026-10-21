// Plans — I/O: the tenant's live subscription (or the audience's free plan),
// the month's usage counted from the base, and the plan change (Stripe mock
// charges on the spot; live Stripe subscriptions are a J item).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { flagOn } from '@/lib/flags'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { chargeNow } from '@/lib/stripe/door'
import { artworkRegistrationGate, comparePublicPlans, monthRange, planFeatureLines, usageBars, type UsageBar } from './core'
import { audienceOfMemberKind, defaultPlanFor, isPlanCode, type PlanAudience, type PlanCode, type UsageKey } from './domain'

export interface PlanView { code: PlanCode; name: string; description: string; priceCents: bigint; audience: PlanAudience; limits: Partial<Record<UsageKey, number | null>>; subscriptionId: number | null }

async function memberAudience(scope: Scope): Promise<{ tenantId: number; memberId: number; audience: PlanAudience } | null> {
  const memberId = memberOfScope(scope), tenantId = tenantOfScope(scope)
  if (!memberId || !tenantId) return null
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { kind: true } })
  if (!m) return null
  return { tenantId, memberId, audience: audienceOfMemberKind(m.kind) }
}

function limitsOf(features: { key: string; limit: number | null }[]): Partial<Record<UsageKey, number | null>> {
  const out: Partial<Record<UsageKey, number | null>> = {}
  for (const f of features) out[f.key as UsageKey] = f.limit
  return out
}

/** The plan in force for the tenant: the ACTIVE/PAST_DUE subscription, else the audience's default. */
export async function currentPlan(tenantId: number, audience: PlanAudience): Promise<PlanView> {
  const sub = await prisma.planSubscription.findFirst({ where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } }, include: { plan: { include: { features: true } } } })
  const plan = sub?.plan ?? (await prisma.plan.findUniqueOrThrow({ where: { code: defaultPlanFor(audience) }, include: { features: true } }))
  return { code: plan.code as PlanCode, name: plan.name, description: plan.description, priceCents: plan.priceCents, audience: plan.audience as PlanAudience, limits: limitsOf(plan.features), subscriptionId: sub?.id ?? null }
}

export async function availablePlans(audience: PlanAudience): Promise<PlanView[]> {
  const rows = await prisma.plan.findMany({ where: { audience, active: true }, include: { features: true }, orderBy: { priceCents: 'asc' } })
  return rows.map((p) => ({ code: p.code as PlanCode, name: p.name, description: p.description, priceCents: p.priceCents, audience, limits: limitsOf(p.features), subscriptionId: null }))
}

/** The month's counts from the base (no PlanUsage table: the truth is what exists). */
export async function usageCounts(tenantId: number, now = new Date()): Promise<Partial<Record<UsageKey, number>>> {
  const { start, end } = monthRange(now)
  const [artworks, orders, certifications, seats, appraisals] = await Promise.all([
    prisma.artwork.count({ where: { tenantId, status: { not: 'ARCHIVED' } } }),
    prisma.markerOrder.findMany({ where: { tenantId }, select: { id: true } }),
    prisma.certificate.count({ where: { issuedAt: { gte: start, lt: end }, artwork: { tenantId } } }),
    prisma.user.count({ where: { tenantId, active: true } }),
    prisma.appraisalRequest.count({ where: { tenantId, createdAt: { gte: start, lt: end } } }),
  ])
  const tags = orders.length === 0 ? 0 : await prisma.physicalMarker.count({ where: { orderId: { in: orders.map((o) => o.id) }, status: 'SHIPPED' } })
  return { ARTWORKS: artworks, TAGS_INCLUDED: tags, APPRAISALS_INCLUDED: appraisals, CERTIFICATIONS_MONTH: certifications, VIEWING_ROOMS: 0, SEATS: seats }
}

export async function usageOf(scope: Scope, now = new Date()): Promise<{ plan: PlanView; bars: UsageBar[]; audience: PlanAudience } | null> {
  const m = await memberAudience(scope)
  if (!m) return null
  const plan = await currentPlan(m.tenantId, m.audience)
  const counts = await usageCounts(m.tenantId, now)
  return { plan, bars: usageBars(m.audience, plan.limits, counts), audience: m.audience }
}

/** The gate the artwork wizard asks before creating a draft (only with FLAG_PLANS). */
export async function registrationGate(scope: Scope): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!flagOn('FLAG_PLANS')) return { ok: true }
  const m = await memberAudience(scope)
  if (!m) return { ok: true }
  const plan = await currentPlan(m.tenantId, m.audience)
  const count = await prisma.artwork.count({ where: { tenantId: m.tenantId, status: { not: 'ARCHIVED' } } })
  return artworkRegistrationGate(count, plan.limits.ARTWORKS ?? null)
}

/** "Mudar de plano": cancels the live subscription, opens the new one and charges the first month (mock). */
export async function changePlan(scope: Scope, code: string, actor: { userId: number }) {
  if (!flagOn('FLAG_PLANS')) throw new ArtworkError('OFF', 'Planos não estão ligados.', 404)
  if (!isPlanCode(code)) throw new ArtworkError('BAD_PLAN', 'Plano desconhecido.', 400)
  const m = await memberAudience(scope)
  if (!m) throw new ArtworkError('NO_MEMBER', 'Só membros mudam de plano.', 403)
  const plan = await prisma.plan.findUnique({ where: { code } })
  if (!plan || !plan.active || plan.audience !== m.audience) throw new ArtworkError('BAD_PLAN', 'Este plano não é do seu perfil.', 400)
  const current = await currentPlan(m.tenantId, m.audience)
  if (current.code === code) throw new ArtworkError('SAME_PLAN', 'Você já está neste plano.', 409)
  const payment = plan.priceCents > 0n ? await chargeNow({ amountCents: plan.priceCents, description: `Plano ${plan.name}` }) : null
  const periodEnd = new Date(Date.now() + 30 * 86_400_000)
  const sub = await prisma.$transaction(async (tx) => {
    await tx.planSubscription.updateMany({ where: { tenantId: m.tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } }, data: { status: 'CANCELLED', endedAt: new Date() } })
    const s = await tx.planSubscription.create({ data: { tenantId: m.tenantId, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: periodEnd, stripeSubscriptionId: payment?.ref ?? null } })
    if (plan.priceCents > 0n) await tx.invoice.create({ data: { tenantId: m.tenantId, kind: 'PLAN', description: `Plano ${plan.name} · mensalidade`, amountCents: plan.priceCents, status: 'PAID', subscriptionId: s.id } })
    return s
  })
  void audit.event({ entity: 'plan_subscription', entityId: sub.id, action: 'change', userId: actor.userId, after: { code } })
  return { subscriptionId: sub.id, code }
}

// ── the public site ("Como funciona" › Preços): every active plan, no session ──
export interface PublicPlan { code: PlanCode; name: string; audience: PlanAudience; priceCents: bigint; description: string; features: string[]; highlighted: boolean }

/** The price cards of the public site. Runs in totalScope (public, no session). */
export async function listPublicPlans(): Promise<PublicPlan[]> {
  return totalScope('public:plans', async () => {
    const rows = await prisma.plan.findMany({ where: { active: true }, include: { features: true } })
    return rows
      .map((p) => ({ code: p.code as PlanCode, name: p.name, audience: p.audience as PlanAudience, priceCents: p.priceCents, description: p.description, features: planFeatureLines(limitsOf(p.features)), highlighted: p.code === 'ARTIST_STUDIO' }))
      .sort(comparePublicPlans)
  })
}
