// Session → scope (the panel guards). Lives in lib/auth so that lib/scope
// stays free of auth and prisma (prisma → scope → auth would be a cycle).
import { AuthError, getSession, hasTotalScope, isInternal, requireAuth, type SessionUser } from './index'
import { enterScope } from '@/lib/scope/context'
import { NONE_SCOPE, scopeOfUser, type Scope } from '@/lib/scope/core'
import { tenantLevelOn } from '@/lib/scope'

export interface PanelSession { user: SessionUser; scope: Scope }

export function scopeOfSession(user: SessionUser): Scope {
  return scopeOfUser(user, () => hasTotalScope(user), { tenantLevel: tenantLevelOn() })
}

/** Guard of OPERATIONAL routes: 401 without session, 403 for external profiles; enters the scope context. */
export async function requirePanel(): Promise<PanelSession> {
  const user = await requireAuth()
  if (!isInternal(user)) throw new AuthError('Acesso restrito ao painel', 403)
  const scope = scopeOfSession(user)
  enterScope(scope, 'requirePanel')
  return { user, scope }
}

/** For PAGES (Server Components): null when there is no panel session — the page redirects. */
export async function panelSession(): Promise<PanelSession | null> {
  const user = await getSession()
  if (!user || !isInternal(user)) return null
  const scope = scopeOfSession(user)
  enterScope(scope, 'panelSession')
  return { user, scope }
}

export async function currentScope(): Promise<Scope> {
  const user = await getSession()
  return user ? scopeOfSession(user) : NONE_SCOPE
}
