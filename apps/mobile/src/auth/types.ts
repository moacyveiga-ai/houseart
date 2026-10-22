export const PROFILE_KINDS = ['COLLECTOR', 'GALLERY', 'ARTIST', 'ADVISOR', 'APPRAISER', 'STAFF'] as const
export type ProfileKind = (typeof PROFILE_KINDS)[number]

export function isProfileKind(v: unknown): v is ProfileKind {
  return typeof v === 'string' && (PROFILE_KINDS as readonly string[]).includes(v)
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
}

/** GET /api/profiles */
export interface ProfileCard { kind: ProfileKind; name: string; icon: string; description: string }
