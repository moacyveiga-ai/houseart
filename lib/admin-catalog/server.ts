// Admin › Catálogo — I/O: the plans with their limits and live subscribers, the services with
// the orders of the last 30 days, and the two updates (plan, service) the desk makes with an
// audit row that lists the fields that changed. Prices and limits only take effect on what is
// placed from now on: a paid subscription keeps its row, a paid order keeps its amount.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { PLAN_AUDIENCE_LABELS } from '@/lib/plans/core'
import { USAGE_KEYS, USAGE_LABELS, type PlanAudience, type UsageKey } from '@/lib/plans/domain'
import { changedKeys, deactivationBlock, isDefaultPlan, SERVICE_ROLE_NOTES, SERVICE_UNIT_LABELS, type AdminPlanRow, type AdminServiceRow, type PlanInput, type ServiceInput, type ServiceUnit } from './core'

const DAY = 86_400_000

export async function adminCatalog(now = new Date()): Promise<{ plans: AdminPlanRow[]; services: AdminServiceRow[] }> {
  return totalScope('admin:catalog', async () => {
    const [plans, subs, services, orders] = await Promise.all([
      prisma.plan.findMany({ include: { features: true }, orderBy: { id: 'asc' } }),
      prisma.planSubscription.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.serviceCatalog.findMany({ orderBy: { id: 'asc' } }),
      prisma.order.groupBy({ by: ['serviceCode'], where: { status: 'PAID', createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, _count: { _all: true } }),
    ])
    const subsOf = new Map(subs.map((s) => [s.planId, s._count._all]))
    const ordersOf = new Map(orders.map((o) => [o.serviceCode, o._count._all]))
    return {
      plans: plans.map((p) => ({
        id: p.id, code: p.code, name: p.name, description: p.description, audience: p.audience as PlanAudience, audienceLabel: PLAN_AUDIENCE_LABELS[p.audience as PlanAudience] ?? p.audience,
        priceCents: String(p.priceCents), active: p.active, isDefault: isDefaultPlan(p.code), activeSubscriptions: subsOf.get(p.id) ?? 0,
        limits: USAGE_KEYS.filter((k) => p.features.some((f) => f.key === k)).map((k) => ({ key: k, label: USAGE_LABELS[k], limit: p.features.find((f) => f.key === k)!.limit })),
      })),
      services: services.map((s) => ({
        id: s.id, code: s.code, name: s.name, description: s.description ?? '', priceCents: String(s.priceCents), unit: s.unit as ServiceUnit, unitLabel: SERVICE_UNIT_LABELS[s.unit as ServiceUnit] ?? s.unit,
        active: s.active, orders30d: ordersOf.get(s.code) ?? 0, note: SERVICE_ROLE_NOTES[s.code] ?? null,
      })),
    }
  })
}

export interface Actor { userId: number; name?: string; ip?: string; userAgent?: string }

/** Name, description, price, active and the limits of the keys sent (a key not sent keeps its value; a key the plan never had is added). */
export async function updatePlan(id: number, input: PlanInput, actor: Actor): Promise<{ changed: string[] }> {
  return totalScope('admin:catalog:plan', async () => {
    const p = await prisma.plan.findUnique({ where: { id }, include: { features: true } })
    if (!p) throw new ArtworkError('NOT_FOUND', 'Plano não encontrado.', 404)
    if (!input.active) { const block = deactivationBlock(p.code); if (block) throw new ArtworkError('DEFAULT_PLAN', block, 409) }
    const before = { name: p.name, description: p.description, priceCents: Number(p.priceCents), active: p.active, limits: Object.fromEntries(p.features.map((f) => [f.key, f.limit])) as Record<string, number | null> }
    const after = { name: input.name, description: input.description, priceCents: input.priceCents, active: input.active, limits: { ...before.limits, ...input.limits } as Record<string, number | null> }
    const changed = changedKeys(before, after) as string[]
    if (changed.length === 0) return { changed }
    await prisma.$transaction(async (tx) => {
      await tx.plan.update({ where: { id }, data: { name: after.name, description: after.description, priceCents: BigInt(after.priceCents), active: after.active } })
      for (const key of Object.keys(input.limits) as UsageKey[]) {
        const limit = input.limits[key] ?? null
        await tx.planFeature.upsert({ where: { planId_key: { planId: id, key } }, create: { planId: id, key, limit }, update: { limit } })
      }
    })
    void audit.update({ entity: 'plan', entityId: id, userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: pick(before, changed), after: { ...pick(after, changed), code: p.code } })
    return { changed }
  })
}

export async function updateService(id: number, input: ServiceInput, actor: Actor): Promise<{ changed: string[] }> {
  return totalScope('admin:catalog:service', async () => {
    const s = await prisma.serviceCatalog.findUnique({ where: { id } })
    if (!s) throw new ArtworkError('NOT_FOUND', 'Serviço não encontrado.', 404)
    const before = { name: s.name, description: s.description ?? '', priceCents: Number(s.priceCents), unit: s.unit, active: s.active }
    const after = { name: input.name, description: input.description, priceCents: input.priceCents, unit: input.unit as string, active: input.active }
    const changed = changedKeys(before, after) as string[]
    if (changed.length === 0) return { changed }
    await prisma.serviceCatalog.update({ where: { id }, data: { name: after.name, description: after.description || null, priceCents: BigInt(after.priceCents), unit: after.unit, active: after.active } })
    void audit.update({ entity: 'service_catalog', entityId: id, userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: pick(before, changed), after: { ...pick(after, changed), code: s.code } })
    return { changed }
  })
}

const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o[k]]))
