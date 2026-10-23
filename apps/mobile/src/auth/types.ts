export const PROFILE_KINDS = ['COLLECTOR', 'GALLERY', 'ARTIST', 'ADVISOR', 'APPRAISER', 'STAFF'] as const
export type ProfileKind = (typeof PROFILE_KINDS)[number]

export function isProfileKind(v: unknown): v is ProfileKind {
  return typeof v === 'string' && (PROFILE_KINDS as readonly string[]).includes(v)
}

export const TEAM_ROLE_KEYS = ['ADMIN', 'SALES', 'INVENTORY'] as const
/** The effective role on a gallery team (null outside one). */
export type TeamRole = (typeof TEAM_ROLE_KEYS)[number]

export function isTeamRole(v: unknown): v is TeamRole {
  return typeof v === 'string' && (TEAM_ROLE_KEYS as readonly string[]).includes(v)
}

/** GET /api/auth/me */
export interface Me {
  id: number
  name: string
  email: string
  profile: string
  activeProfileKind: ProfileKind | null
  memberId: number | null
  tenantId: number | null
  /** Gallery team role (Admin · Vendas · Acervo); null for anyone else. */
  teamRole: TeamRole | null
}

/** GET /api/profiles */
export interface ProfileCard { kind: ProfileKind; name: string; icon: string; description: string }
