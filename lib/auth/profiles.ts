// Login profiles (`User.profile`) — PURE taxonomy. Product profiles the person
// switches between live in lib/profiles (UserProfile). Here: who is staff
// (total scope), who is a scoped member, who is external.
export const PROFILES = ['admin', 'manager', 'operator', 'finance', 'member', 'appraiser', 'collector', 'institution'] as const
export type Profile = (typeof PROFILES)[number]

/** Staff of the house: the whole base. */
export const STAFF_PROFILES: readonly Profile[] = ['admin', 'manager', 'operator', 'finance']
/** Scoped by tenant/member. */
export const SCOPED_PROFILES: readonly Profile[] = ['member', 'appraiser']
/** External: own portals, never the panel. */
export const EXTERNAL_PROFILES: readonly Profile[] = ['collector', 'institution']
/** Can open the panel shell (staff + scoped + the collector, whose pages read by userId). */
export const PANEL_PROFILES: readonly Profile[] = [...STAFF_PROFILES, ...SCOPED_PROFILES, 'collector']
/** Profiles that never get a panel session even with the right password. */
export const NO_PANEL_LOGIN_PROFILES: readonly Profile[] = ['institution']

export const AUTHENTICATION_DESK_PROFILES: readonly Profile[] = ['admin', 'manager', 'operator']
export const FINANCE_ADMIN_PROFILES: readonly Profile[] = ['admin', 'manager']
export const FINANCE_OPS_PROFILES: readonly Profile[] = ['admin', 'manager', 'finance']
export const FINANCE_READ_PROFILES: readonly Profile[] = ['admin', 'manager', 'finance', 'operator']
export const MEMBER_APPROVAL_PROFILES: readonly Profile[] = ['admin', 'manager']
/** The house team that edits the public site (news and agenda). Finance does not. */
export const CONTENT_EDITOR_PROFILES: readonly Profile[] = ['admin', 'manager', 'operator']

export interface ProfilePrincipal { profile: string }
const profileOf = (p: string | ProfilePrincipal): string => (typeof p === 'string' ? p : p.profile)
const has = (list: readonly Profile[], p: string | ProfilePrincipal) => (list as readonly string[]).includes(profileOf(p))

export const hasTotalScope = (p: string | ProfilePrincipal) => has(STAFF_PROFILES, p)
export const isInternal = (p: string | ProfilePrincipal) => has(PANEL_PROFILES, p)
export const isExternal = (p: string | ProfilePrincipal) => has(EXTERNAL_PROFILES, p)
export const canManageAdmin = (p: string | ProfilePrincipal) => profileOf(p) === 'admin'
export const canOperateAuthenticationDesk = (p: string | ProfilePrincipal) => has(AUTHENTICATION_DESK_PROFILES, p)
export const canEditPublicContent = (p: string | ProfilePrincipal) => has(CONTENT_EDITOR_PROFILES, p)
export const canApproveMembers = (p: string | ProfilePrincipal) => has(MEMBER_APPROVAL_PROFILES, p)
export const canAdministerFinance = (p: string | ProfilePrincipal) => has(FINANCE_ADMIN_PROFILES, p)
export const canOperateFinance = (p: string | ProfilePrincipal) => has(FINANCE_OPS_PROFILES, p)
export const canReadFinance = (p: string | ProfilePrincipal) => has(FINANCE_READ_PROFILES, p)

/** Unknown profile falls to `institution`: no panel, no scope (fail-closed). */
export function knownProfile(p: string): Profile {
  return (PROFILES as readonly string[]).includes(p) ? (p as Profile) : 'institution'
}

/** Hierarchy for user management: only a higher level edits a lower one. */
export function profileLevel(p: string): number {
  switch (p) {
    case 'admin': return 4
    case 'manager': return 3
    case 'operator': case 'finance': return 2
    case 'member': case 'appraiser': return 1
    default: return 0
  }
}
