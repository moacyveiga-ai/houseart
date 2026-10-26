// Admin › Galerias e contas — pure rules (audit 2026-10-25, web-app §5: "Galerias/tenants:
// dados, plano, equipe, contrato"). The row of each tenant (gallery or autonomous person),
// the filters, the KPIs and what the desk may do: grant a plan as courtesy, suspend, reinstate.
import { canApproveMembers } from '@/lib/auth/profiles'

export const TENANT_FILTERS = ['galleries', 'persons', 'paid', 'suspended', 'all'] as const
export type TenantFilter = (typeof TENANT_FILTERS)[number]
export const TENANT_FILTER_LABELS: Record<TenantFilter, string> = { galleries: 'Galerias', persons: 'Autônomos', paid: 'Com plano pago', suspended: 'Suspensas', all: 'Todas' }
export const filterKey = (raw: string | undefined): TenantFilter => (TENANT_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as TenantFilter) : 'all'

export const TENANT_KIND_LABELS: Record<string, string> = { GALLERY: 'galeria', PERSON: 'autônomo' }
export const TENANT_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativa', SUSPENDED: 'Suspensa' }
export const SUBSCRIPTION_LABELS: Record<string, string> = { ACTIVE: 'em dia', PAST_DUE: 'em atraso', DEFAULT: 'padrão (sem assinatura)' }
export const NOTE_MAX = 200

export interface Actor { profile: string }
/** Admin and manager (the desk that approves members) grant plans and suspend; the rest of the team reads. */
export const canManageTenants = (a: Actor) => canApproveMembers(a.profile)

export interface AdminTenantRow {
  id: number; kind: string; kindLabel: string; name: string; slug: string; status: string; statusLabel: string
  /** Public page of the gallery (`/e/gallery/<slug>`), when it has one. */
  publicSlug: string | null
  createdAt: string
  /** The legal identity the gallery typed (CNPJ only as a mask; the hash never leaves). */
  legalName: string | null; cnpjMask: string | null
  admin: { id: number; name: string; email: string } | null
  members: { artists: number; staff: number; advisors: number; collectors: number; pending: number }
  team: { admin: number; sales: number; inventory: number; pendingInvites: number }
  /** Active representation contracts (galleries). */
  contracts: number
  artworks: number; listed: number; certificates: number; openDeals: number
  plan: { code: string; name: string; priceCents: string; subscription: 'ACTIVE' | 'PAST_DUE' | 'DEFAULT'; periodEnd: string | null; paid: boolean }
  audience: 'ARTIST' | 'GALLERY' | 'ADVISOR'
  can: { plan: boolean; suspend: boolean; reinstate: boolean }
}

export function parseQuery(raw: string | undefined): { id: number | null; text: string } {
  const t = (raw ?? '').trim()
  const m = /^#(\d{1,9})$/.exec(t)
  return { id: m ? Number(m[1]) : null, text: m ? '' : t.slice(0, 80) }
}

export function matchesFilter(r: Pick<AdminTenantRow, 'kind' | 'status' | 'plan'>, f: TenantFilter): boolean {
  switch (f) {
    case 'galleries': return r.kind === 'GALLERY'
    case 'persons': return r.kind !== 'GALLERY'
    case 'paid': return r.plan.paid
    case 'suspended': return r.status === 'SUSPENDED'
    case 'all': return true
  }
}

export function kpisOf(rows: Pick<AdminTenantRow, 'kind' | 'status' | 'plan' | 'team'>[]) {
  return {
    galleries: rows.filter((r) => r.kind === 'GALLERY').length,
    persons: rows.filter((r) => r.kind !== 'GALLERY').length,
    paid: rows.filter((r) => r.plan.paid).length,
    pastDue: rows.filter((r) => r.plan.subscription === 'PAST_DUE').length,
    suspended: rows.filter((r) => r.status === 'SUSPENDED').length,
    pendingInvites: rows.reduce((n, r) => n + r.team.pendingInvites, 0),
  }
}

export const canGrantPlan = (a: Actor, r: Pick<AdminTenantRow, 'status'>) => canManageTenants(a) && r.status === 'ACTIVE'
export const canSuspend = (a: Actor, r: Pick<AdminTenantRow, 'status'>) => canManageTenants(a) && r.status === 'ACTIVE'
export const canReinstate = (a: Actor, r: Pick<AdminTenantRow, 'status'>) => canManageTenants(a) && r.status === 'SUSPENDED'

/** The plan audience of a tenant: galleries by kind; a person by the members it holds (a lone collector counts as artist). */
export function audienceOf(kind: string, memberKinds: string[]): 'ARTIST' | 'GALLERY' | 'ADVISOR' {
  if (kind === 'GALLERY') return 'GALLERY'
  if (memberKinds.includes('ARTIST')) return 'ARTIST'
  if (memberKinds.includes('ADVISOR')) return 'ADVISOR'
  return 'ARTIST'
}
