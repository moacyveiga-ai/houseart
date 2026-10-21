// Auth — sessions in the database (immediate revocation, no JWT) + bcrypt.
// Cookie `houseart_session` carries the token; the row keeps the hash.
// `AUTH_PROVIDER=supabase` is reserved (HOUSEART_BUILD.md §J): the MVP ships
// the local mode only.
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { afterResponse } from '@/lib/after'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { classifyCredential } from './credential'
import { createLocalSession, sessionTokenKey } from './local-session'
import {
  hasTotalScope, isInternal, knownProfile, NO_PANEL_LOGIN_PROFILES, canReadFinance, canOperateFinance, canAdministerFinance,
  type Profile, type ProfilePrincipal,
} from './profiles'

export const COOKIE_NAME = 'houseart_session'
export { SESSION_DURATION_DAYS, sessionCookieOptions, createLocalSession } from './local-session'
export * from './profiles'
export { classifyCredential, normalizeEmail } from './credential'

export interface SessionUser extends ProfilePrincipal {
  id: number
  name: string
  email: string
  cpf: string | null
  profile: Profile
  /** Commercial profile (Member) of this login — the base of the scope. */
  memberId: number | null
  tenantId: number | null
  tenantRole: 'ADMIN' | 'MEMBER' | null
  /** Product profile active in this session (lib/profiles); null = not chosen yet. */
  activeProfileKind: string | null
  /** Session row id (to switch the active profile). */
  sessionId: number | null
}

export function hashPassword(plain: string): Promise<string> { return bcrypt.hash(plain, 10) }
export function verifyPassword(plain: string, hash: string): Promise<boolean> { return bcrypt.compare(plain, hash) }

type UserRow = {
  id: number; name: string; email: string; cpf: string | null; profile: string
  memberId: number | null; tenantId: number | null; tenantRole: string | null
}

export function userForSession(u: UserRow, session: { id: number | null; activeProfileKind: string | null } = { id: null, activeProfileKind: null }): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    cpf: u.cpf,
    profile: knownProfile(u.profile),
    memberId: u.memberId ?? null,
    tenantId: u.tenantId ?? null,
    tenantRole: u.tenantRole === 'ADMIN' || u.tenantRole === 'MEMBER' ? u.tenantRole : null,
    activeProfileKind: session.activeProfileKind,
    sessionId: session.id,
  }
}

export type LoginResult = { ok: true; user: SessionUser; token: string } | { ok: false; error: string }

/** Login by e-mail/CPF + password. The error text never reveals whether the account exists. */
export async function loginWithPassword(opt: { credential: string; password: string; ip?: string; userAgent?: string }): Promise<LoginResult> {
  const cred = classifyCredential(opt.credential)
  if (cred.kind === 'empty' || !opt.password) return { ok: false, error: 'E-mail e senha obrigatórios' }
  const user = cred.kind === 'cpf'
    ? await prisma.user.findFirst({ where: { cpf: cred.cpf } })
    : await prisma.user.findFirst({ where: { email: cred.email } })
  if (!user) return { ok: false, error: 'Credenciais inválidas' }
  const proved = user.passwordHash ? await verifyPassword(opt.password, user.passwordHash) : false
  if (!proved) return { ok: false, error: 'Credenciais inválidas' }
  if (!user.active) return { ok: false, error: 'Conta inativa ou em análise' }
  if ((NO_PANEL_LOGIN_PROFILES as readonly string[]).includes(user.profile)) return { ok: false, error: 'Perfil sem acesso ao painel' }
  return openSession(user, { ip: opt.ip, userAgent: opt.userAgent })
}

/** Opens a session for a user already proven by another door (code, access link). */
export async function openSession(user: UserRow & { active?: boolean }, ctx: { ip?: string; userAgent?: string }): Promise<LoginResult> {
  const defaultProfile = await prisma.userProfile.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
  const profiles = await prisma.userProfile.count({ where: { userId: user.id } })
  // One profile → it is the active one; several → the person chooses (/profiles).
  const activeProfileKind = profiles === 1 && defaultProfile ? defaultProfile.kind : null
  const token = await createLocalSession(user.id, { ...ctx, activeProfileKind })
  afterResponse('auth: last login', () => prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }))
  return { ok: true, token, user: userForSession(user, { id: null, activeProfileKind }) }
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token: sessionTokenKey(token) } }).catch(() => {})
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return getSessionByToken(token)
}

export async function getSessionByToken(token: string): Promise<SessionUser | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const session = await prisma.session.findUnique({ where: { token: sessionTokenKey(token) }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    afterResponse('auth: expired session', () => prisma.session.deleteMany({ where: { id: session.id } }))
    return null
  }
  if (!session.user.active) return null
  afterResponse('auth: session last use', () => prisma.session.updateMany({ where: { id: session.id }, data: { lastUsedAt: new Date() } }))
  return userForSession(session.user, { id: session.id, activeProfileKind: session.activeProfileKind })
}

export class AuthError extends Error {
  status: number
  constructor(msg: string, status = 401) { super(msg); this.status = status }
}

export async function requireAuth(): Promise<SessionUser> {
  const u = await getSession()
  if (!u) throw new AuthError('Não autenticado', 401)
  return u
}

export async function requireProfile(profiles: Profile[] | Profile): Promise<SessionUser> {
  const u = await requireAuth()
  const list = Array.isArray(profiles) ? profiles : [profiles]
  if (!(u.profile === 'admin' || list.includes(u.profile))) throw new AuthError(`Acesso restrito a: ${list.join(', ')}`, 403)
  return u
}

/** Panel capability (staff + scoped members). Visibility is still the scope's job. */
export async function requireInternal(): Promise<SessionUser> {
  const u = await requireAuth()
  if (!isInternal(u)) throw new AuthError('Acesso restrito ao painel', 403)
  return u
}

/** The whole base: staff only. */
export async function requireStaff(): Promise<SessionUser> {
  const u = await requireAuth()
  if (!hasTotalScope(u)) throw new AuthError('Acesso restrito à equipe interna', 403)
  return u
}

export async function requireFinance(level: 'read' | 'operate' | 'administer'): Promise<SessionUser> {
  const u = await requireAuth()
  const ok = level === 'read' ? canReadFinance(u) : level === 'operate' ? canOperateFinance(u) : canAdministerFinance(u)
  if (!ok) throw new AuthError('Acesso restrito à equipe financeira', 403)
  return u
}

export async function sessionContext(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers()
  const raw = rawIpFromHeaders(h)
  return { ip: raw === 'no-ip' ? undefined : raw, userAgent: h.get('user-agent') ?? undefined }
}
