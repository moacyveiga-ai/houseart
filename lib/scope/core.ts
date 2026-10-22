// Data scope — PURE CORE (no prisma, no cookies, testable). Ported from the
// Housebroker (lib/escopo/core.ts, ADR-010).
//
// Four levels; what differs is WHAT is seen, not WHERE one enters:
//
//   total    HouseArt staff                     the whole base
//   tenant   ADMIN of the tenant (gallery)       the tenant's whole inventory
//   member   MEMBER of the tenant (artist…)      only their own portfolio
//   none     member without a link              nothing
//
// The fourth case is the one that holds the house: a login without a resolved
// `memberId` sees NOTHING — never everything. Fail-closed. Same for the tenant:
// an ADMIN without a resolved `tenantId` is not a tenant scope.
//
// The builders return `where` FRAGMENTS to be spread inside existing queries.
// Scope `none` becomes `{ id: { in: [] } }`, empty by construction. No builder
// returns `{}` for tenant: `{}` means "bring everything" and only staff gets it.

export type Scope =
  | { kind: 'total' }
  /** Tenant ADMIN: everything of the tenant. `memberId` is the admin's own member identity (or null). */
  | { kind: 'tenant'; tenantId: number; memberId: number | null }
  /** Member: only their own portfolio. `tenantId` is the tenant they belong to (or null). */
  | { kind: 'member'; memberId: number; tenantId: number | null }
  | { kind: 'none' }

export const TOTAL_SCOPE: Scope = { kind: 'total' }
export const NONE_SCOPE: Scope = { kind: 'none' }

/** `where` fragment that matches nothing — the empty-by-construction of scope `none`. Spread it (`{ ...NOTHING }`). */
export const NOTHING = { id: { in: [] as number[] } } as const

function validId(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

export interface UserForScope {
  profile: string
  memberId: number | null
  tenantId?: number | null
  /** 'ADMIN' manages the whole tenant; 'MEMBER' operates their own portfolio. */
  tenantRole?: string | null
  /** Member.kind: GALLERY_STAFF of any team role sees the gallery's whole inventory and offers. */
  memberKind?: string | null
}

/**
 * staff (hasTotalScope) → total; tenantRole ADMIN with valid tenantId → tenant;
 * valid memberId → member; otherwise → none. `options.tenantLevel` (default
 * true) is the FLAG_TENANT_SCOPE key: off, the ADMIN falls to their own portfolio.
 */
export function scopeOfUser(
  user: UserForScope | null | undefined,
  hasTotalScope: (profile: string) => boolean,
  options: { tenantLevel?: boolean } = {},
): Scope {
  if (!user) return NONE_SCOPE
  if (hasTotalScope(user.profile)) return TOTAL_SCOPE
  const tenantId = validId(user.tenantId) ? user.tenantId : null
  const memberId = validId(user.memberId) ? user.memberId : null
  const tenantLevel = options.tenantLevel ?? true
  if (tenantLevel && (user.tenantRole === 'ADMIN' || user.memberKind === 'GALLERY_STAFF') && tenantId !== null) {
    return { kind: 'tenant', tenantId, memberId }
  }
  return memberId !== null ? { kind: 'member', memberId, tenantId } : NONE_SCOPE
}

export function isTotal(scope: Scope): boolean { return scope.kind === 'total' }
export function isTenant(scope: Scope): boolean { return scope.kind === 'tenant' }

/** Commercial identity of the session (member of `member` scope, or the admin's own member). Total/none → null. */
export function memberOfScope(scope: Scope): number | null {
  if (scope.kind === 'member') return scope.memberId
  if (scope.kind === 'tenant') return scope.memberId
  return null
}

export function tenantOfScope(scope: Scope): number | null {
  if (scope.kind === 'tenant') return scope.tenantId
  if (scope.kind === 'member') return scope.tenantId
  return null
}

/** Entity that points directly to the member AND carries the denormalized `tenantId` column. */
export function memberFilter(scope: Scope, field = 'memberId', tenantField = 'tenantId'): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') return { [tenantField]: scope.tenantId }
  return { [field]: scope.memberId }
}

/** Entity that reaches the member through a RELATION (e.g. `artwork`). */
export function relationFilter(scope: Scope, relation: string, field = 'memberId', tenantField = 'tenantId'): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') return { [relation]: { [tenantField]: scope.tenantId } }
  return { [relation]: { [field]: scope.memberId } }
}

/** Direct link OR relation (e.g. an offer by another member on MY artwork). Always wrapped in AND. */
export function memberOrRelationFilter(
  scope: Scope,
  relation: string,
  directField = 'memberId',
  relationField = 'memberId',
  directTenantField = 'tenantId',
  relationTenantField = 'tenantId',
): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') {
    return { AND: [{ OR: [{ [directTenantField]: scope.tenantId }, { [relation]: { [relationTenantField]: scope.tenantId } }] }] }
  }
  return { AND: [{ OR: [{ [directField]: scope.memberId }, { [relation]: { [relationField]: scope.memberId } }] }] }
}

/** Model WITHOUT `tenantId` but WITH a relation to `Member`. */
export function tenantViaMemberFilter(scope: Scope, memberRelation = 'member', field = 'memberId'): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') return { [memberRelation]: { tenantId: scope.tenantId } }
  return { [field]: scope.memberId }
}

/** Model with only the SCALAR `memberId`: the tenant level receives the resolved member list. */
export function memberWithoutTenantFilter(scope: Scope, membersOfTenant: readonly number[], field = 'memberId'): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') return { [field]: { in: [...membersOfTenant] } }
  return { [field]: scope.memberId }
}

/** Member PICKER: who the member can see as a colleague (same tenant + self; without tenant, only self). */
export function tenantColleaguesFilter(scope: Scope): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') {
    return scope.memberId !== null ? { OR: [{ tenantId: scope.tenantId }, { id: scope.memberId }] } : { tenantId: scope.tenantId }
  }
  return scope.tenantId !== null ? { OR: [{ tenantId: scope.tenantId }, { id: scope.memberId }] } : { id: scope.memberId }
}

/** Entity owned by the whole TENANT (not a member). Member without tenant → nothing (fail-closed). */
export function tenantFilter(scope: Scope, tenantField = 'tenantId'): Record<string, unknown> {
  if (scope.kind === 'total') return {}
  if (scope.kind === 'none') return { ...NOTHING }
  if (scope.kind === 'tenant') return { [tenantField]: scope.tenantId }
  return scope.tenantId !== null ? { [tenantField]: scope.tenantId } : { ...NOTHING }
}

export interface OwnedRecord {
  memberId?: number | null
  tenantId?: number | null
  /** For a row without `tenantId`: select `member: { select: { tenantId } }`. */
  member?: { tenantId?: number | null } | null
}

/** Read guard by id with the row in hand. Out of scope = NON-EXISTENT (404, never 403). */
export function canView(scope: Scope, record: OwnedRecord | null | undefined): boolean {
  if (!record) return false
  if (scope.kind === 'total') return true
  if (scope.kind === 'none') return false
  if (scope.kind === 'tenant') return record.tenantId === scope.tenantId || record.member?.tenantId === scope.tenantId
  return record.memberId === scope.memberId
}

/** Same guard for writes: reading scoped and writing loose is the classic hole. */
export function canWrite(scope: Scope, record: OwnedRecord | null | undefined): boolean {
  return canView(scope, record)
}
