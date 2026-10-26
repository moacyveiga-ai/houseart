// Admin › Galerias e contas — I/O: every tenant of the house with what the desk needs at a
// glance (plan in force, team and invites, represented artists, inventory, the gallery's legal
// identity as a mask) and three actions: grant a plan as courtesy (no charge, no invoice),
// suspend (the panel refuses the members, the public site hides the works) and reinstate.
// Audited on entity `tenant`; the CNPJ hash and cipher never leave.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { defaultPlanFor, isPlanCode } from '@/lib/plans/domain'
import { STAFF_PROFILES } from '@/lib/auth/profiles'
import { audienceOf, canGrantPlan, TENANT_TAKE, canReinstate, canSuspend, NOTE_MAX, parseQuery, TENANT_KIND_LABELS, TENANT_STATUS_LABELS, type Actor, type AdminTenantRow } from './core'


export interface PlanOption { code: string; name: string; audience: string; priceCents: string }

export async function adminTenants(actor: Actor, rawQuery: string | undefined): Promise<{ rows: AdminTenantRow[]; plans: PlanOption[] }> {
  const q = parseQuery(rawQuery)
  return totalScope('admin:tenants', async () => {
    const where = q.id !== null ? { id: q.id } : q.text ? { OR: [{ name: { contains: q.text, mode: 'insensitive' as const } }, { slug: { contains: q.text, mode: 'insensitive' as const } }, { galleryProfile: { legalName: { contains: q.text, mode: 'insensitive' as const } } }] } : {}
    const tenants = await prisma.tenant.findMany({
      where, orderBy: { id: 'desc' }, take: TENANT_TAKE,
      select: {
        id: true, kind: true, name: true, slug: true, status: true, createdAt: true,
        galleryProfile: { select: { legalName: true, cnpjMask: true } },
        publicProfile: { select: { slug: true } },
        members: { select: { kind: true, status: true, role: true } },
        // who runs it: the login with tenantRole ADMIN, or the gallery member with role ADMIN (team-server accepts both)
        users: { where: { active: true, OR: [{ tenantRole: 'ADMIN' }, { member: { kind: 'GALLERY_STAFF', role: 'ADMIN' } }] }, select: { id: true, name: true, email: true }, orderBy: { id: 'asc' }, take: 1 },
        subscriptions: { where: { status: { in: ['ACTIVE', 'PAST_DUE'] } }, select: { status: true, currentPeriodEnd: true, plan: { select: { code: true, name: true, priceCents: true } } }, orderBy: { id: 'desc' }, take: 1 },
      },
    })
    const ids = tenants.map((t) => t.id)
    const [plans, invites, contracts, artworks, listed, certificates, deals] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, select: { code: true, name: true, audience: true, priceCents: true }, orderBy: [{ audience: 'asc' }, { priceCents: 'asc' }] }),
      prisma.teamInvite.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, status: 'PENDING', expiresAt: { gt: new Date() } }, _count: { _all: true } }),
      prisma.artistContract.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.artwork.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, status: { not: 'ARCHIVED' } }, _count: { _all: true } }),
      prisma.artwork.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, status: 'LISTED' }, _count: { _all: true } }),
      prisma.artwork.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, certificate: { status: 'ACTIVE' } }, _count: { _all: true } }),
      prisma.deal.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, phase: { not: 'COMPLETED' }, OR: [{ exceptionStatus: null }, { exceptionStatus: 'DISPUTE' }] }, _count: { _all: true } }),
    ])
    const countOf = (g: { tenantId: number | null; _count: { _all: number } }[]) => new Map(g.map((x) => [x.tenantId, x._count._all]))
    const invitesOf = countOf(invites), contractsOf = countOf(contracts), artworksOf = countOf(artworks), listedOf = countOf(listed), certsOf = countOf(certificates), dealsOf = countOf(deals)
    const planByCode = new Map(plans.map((p) => [p.code, p]))
    const rows = tenants.map((t): AdminTenantRow => {
      const kinds = t.members.map((m) => m.kind)
      const audience = audienceOf(t.kind, kinds)
      const sub = t.subscriptions[0] ?? null
      const plan = sub?.plan ?? planByCode.get(defaultPlanFor(audience)) ?? { code: defaultPlanFor(audience), name: defaultPlanFor(audience), priceCents: 0n }
      const staff = t.members.filter((m) => m.kind === 'GALLERY_STAFF' && m.status === 'ACTIVE')
      const base = { status: t.status }
      return {
        id: t.id, kind: t.kind, kindLabel: TENANT_KIND_LABELS[t.kind] ?? t.kind, name: t.name, slug: t.slug, status: t.status, statusLabel: TENANT_STATUS_LABELS[t.status] ?? t.status,
        publicSlug: t.publicProfile?.slug ?? null, createdAt: t.createdAt.toISOString(),
        legalName: t.galleryProfile?.legalName ?? null, cnpjMask: t.galleryProfile?.cnpjMask ?? null,
        admin: t.users[0] ?? null,
        members: { artists: t.members.filter((m) => m.kind === 'ARTIST' && m.status === 'ACTIVE').length, staff: staff.length, advisors: t.members.filter((m) => m.kind === 'ADVISOR' && m.status === 'ACTIVE').length, collectors: t.members.filter((m) => m.kind === 'COLLECTOR' && m.status === 'ACTIVE').length, pending: t.members.filter((m) => m.status === 'PENDING').length },
        team: { admin: staff.filter((m) => m.role === 'ADMIN').length, sales: staff.filter((m) => m.role === 'SALES').length, inventory: staff.filter((m) => m.role === 'INVENTORY').length, pendingInvites: invitesOf.get(t.id) ?? 0 },
        contracts: contractsOf.get(t.id) ?? 0,
        artworks: artworksOf.get(t.id) ?? 0, listed: listedOf.get(t.id) ?? 0, certificates: certsOf.get(t.id) ?? 0, openDeals: dealsOf.get(t.id) ?? 0,
        plan: { code: plan.code, name: plan.name, priceCents: plan.priceCents.toString(), subscription: sub ? (sub.status as 'ACTIVE' | 'PAST_DUE') : 'DEFAULT', periodEnd: sub?.currentPeriodEnd?.toISOString() ?? null, paid: sub?.status === 'ACTIVE' && plan.priceCents > 0n },
        audience,
        can: { plan: canGrantPlan(actor, base), suspend: canSuspend(actor, base), reinstate: canReinstate(actor, base) },
      }
    })
    return { rows, plans: plans.map((p) => ({ code: p.code, name: p.name, audience: p.audience, priceCents: p.priceCents.toString() })) }
  })
}

type Ctx = Actor & { userId: number; name: string; ip?: string; userAgent?: string }
const noteOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().slice(0, NOTE_MAX) : '')

async function tenantOf(id: number) {
  const t = await prisma.tenant.findUnique({ where: { id }, select: { id: true, kind: true, status: true, name: true, members: { select: { kind: true } } } })
  if (!t) throw new ArtworkError('NOT_FOUND', 'Conta não encontrada.', 404)
  return t
}

/** One lock per tenant for every write of its subscriptions (two clicks, or the desk and the member at once, never leave two ACTIVE). */
const PLAN_LOCK_NS = 7_431_002

/**
 * Courtesy plan: the live subscription is closed and a new one opens on the chosen plan with no
 * charge, no invoice and no term (nothing in the repo expires a subscription: it lasts until the
 * account changes plan again — the modal says so). The plan must be of the tenant's audience.
 */
export async function grantPlan(id: number, rawCode: unknown, rawNote: unknown, actor: Ctx): Promise<{ code: string; name: string }> {
  const note = noteOf(rawNote)
  if (!note) throw new ArtworkError('NOTE', 'Diga o motivo da cortesia.', 422)
  const code = typeof rawCode === 'string' ? rawCode : ''
  if (!isPlanCode(code)) throw new ArtworkError('BAD_PLAN', 'Plano desconhecido.', 400)
  return totalScope('admin:tenants:plan', async () => {
    const t = await tenantOf(id)
    if (!canGrantPlan(actor, t)) throw new ArtworkError('FORBIDDEN', t.status === 'ACTIVE' ? 'Só admin e gestor concedem plano.' : 'Reative a conta antes de mudar o plano.', t.status === 'ACTIVE' ? 403 : 409)
    const plan = await prisma.plan.findUnique({ where: { code }, select: { id: true, code: true, name: true, audience: true, active: true } })
    const audience = audienceOf(t.kind, t.members.map((m) => m.kind))
    if (!plan || !plan.active || plan.audience !== audience) throw new ArtworkError('BAD_PLAN', 'Este plano não é do perfil desta conta.', 400)
    const { sub, current } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAN_LOCK_NS}, ${id})`
      const current = await tx.planSubscription.findFirst({ where: { tenantId: id, status: { in: ['ACTIVE', 'PAST_DUE'] } }, select: { id: true, planId: true, status: true }, orderBy: { id: 'desc' } })
      if (current?.planId === plan.id && current.status === 'ACTIVE') throw new ArtworkError('SAME_PLAN', 'A conta já está neste plano.', 409)
      await tx.planSubscription.updateMany({ where: { tenantId: id, status: { in: ['ACTIVE', 'PAST_DUE'] } }, data: { status: 'CANCELLED', endedAt: new Date() } })
      const sub = await tx.planSubscription.create({ data: { tenantId: id, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: null } })
      return { sub, current }
    })
    void audit.event({ entity: 'tenant', entityId: id, action: 'plan_granted', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { subscriptionId: current?.id ?? null }, after: { subscriptionId: sub.id, code: plan.code, note, courtesy: true } })
    return { code: plan.code, name: plan.name }
  })
}

/** Suspends (note required: the people will ask why) or reinstates the tenant. CAS on the status. */
export async function setTenantStatus(id: number, status: 'SUSPENDED' | 'ACTIVE', rawNote: unknown, actor: Ctx): Promise<{ status: string; closedSessions: number }> {
  const note = noteOf(rawNote)
  if (status === 'SUSPENDED' && !note) throw new ArtworkError('NOTE', 'Diga o motivo da suspensão.', 422)
  return totalScope('admin:tenants:status', async () => {
    const t = await tenantOf(id)
    const ok = status === 'SUSPENDED' ? canSuspend(actor, t) : canReinstate(actor, t)
    if (!ok) throw new ArtworkError('FORBIDDEN', t.status === status ? 'A conta já está assim.' : 'Só admin e gestor suspendem ou reativam uma conta.', t.status === status ? 409 : 403)
    const w = await prisma.tenant.updateMany({ where: { id, status: t.status }, data: { status } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A conta acabou de mudar.', 409)
    // the open sessions of the members end now (the panel would refuse them anyway on the next request)
    const closed = status === 'SUSPENDED' ? await prisma.session.deleteMany({ where: { user: { tenantId: id, profile: { notIn: [...STAFF_PROFILES] } } } }) : { count: 0 }
    void audit.event({ entity: 'tenant', entityId: id, action: status === 'SUSPENDED' ? 'suspend' : 'reinstate', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { status: t.status }, after: { status, note: note || undefined, closedSessions: closed.count } })
    return { status, closedSessions: closed.count }
  })
}
