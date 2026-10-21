import { requireAuth, AuthError, type SessionUser } from '@/lib/auth'
import { hasTotalScope } from '@/lib/auth/profiles'

/** The appraiser's desk: login profile `appraiser` or staff. */
export async function requireAppraiser(): Promise<SessionUser> {
  const u = await requireAuth()
  if (u.profile !== 'appraiser' && !hasTotalScope(u)) throw new AuthError('Acesso restrito a avaliadores', 403)
  return u
}
