// OAuth / social login — the I/O: state cookie, code exchange, identity
// resolution, link or create the account, open the session. The pure
// decisions live in core.ts. Tokens of the provider are used once and never
// stored (the MVP only needs the identity).
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { decryptText, encryptText } from '@/lib/crypto/cipher'
import { publicBaseUrl } from '@/lib/public-url'
import { normalizeEmail, openSession, type LoginResult } from '@/lib/auth'
import { createMemberAccount } from '@/lib/accounts/signup-server'
import {
  STATE_COOKIE, STATE_TTL_MS, TOKEN_URL, authorizeUrl, configOf, decideOAuth, decodeJwtPayload, newNonce, newVerifier, stateFresh,
  type ExternalIdentity, type OAuthProvider, type OAuthPurpose, type OAuthState,
} from './core'

const SELF_SIGNUP = ['ARTIST', 'GALLERY', 'ADVISOR', 'COLLECTOR'] as const

export function redirectUriOf(provider: OAuthProvider): string {
  return `${publicBaseUrl()}/api/auth/oauth/${provider.toLowerCase()}/callback`
}

/** Builds the state, stows it (encrypted) in an httpOnly cookie and returns the provider URL. */
export async function beginOAuth(provider: OAuthProvider, opt: { purpose: OAuthPurpose; profileKind: string | null; plan: string | null; next: string | null }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cfg = configOf(provider, process.env)
  if (!cfg) return { ok: false, error: 'Este provedor ainda não está configurado.' }
  const state: OAuthState = { nonce: newNonce(), provider, purpose: opt.purpose, profileKind: opt.profileKind, plan: opt.plan, next: opt.next, verifier: newVerifier(), issuedAt: Date.now() }
  const jar = await cookies()
  const production = process.env.NODE_ENV === 'production'
  jar.set(STATE_COOKIE, encryptText(JSON.stringify(state)), {
    httpOnly: true,
    path: '/api/auth/oauth',
    maxAge: STATE_TTL_MS / 1000,
    secure: production,
    // Apple answers by cross-site POST (form_post): a Lax cookie would not travel with it.
    sameSite: production ? 'none' : 'lax',
  })
  return { ok: true, url: authorizeUrl(provider, cfg, redirectUriOf(provider), state, publicBaseUrl()) }
}

/** Reads and clears the state cookie; null when absent, stale or not for this provider/nonce. */
export async function takeState(provider: OAuthProvider, nonce: string): Promise<OAuthState | null> {
  const jar = await cookies()
  const raw = jar.get(STATE_COOKIE)?.value
  jar.delete(STATE_COOKIE)
  if (!raw) return null
  let state: OAuthState
  try { state = JSON.parse(decryptText(raw)) as OAuthState } catch { return null }
  if (state.provider !== provider || state.nonce !== nonce || !stateFresh(state, Date.now())) return null
  return state
}

async function postForm(url: string, form: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) { console.error('[oauth] token endpoint respondeu', res.status); return null }
    return await res.json() as Record<string, unknown>
  } catch (e) {
    console.error('[oauth] falha no token endpoint:', e instanceof Error ? e.name : e)
    return null
  }
}

async function getJson(url: string, bearer: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    return await res.json() as Record<string, unknown>
  } catch { return null }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Exchanges the code and resolves the identity at the provider. `appleUser` is the one-time `user` JSON Apple posts. */
export async function resolveIdentity(provider: OAuthProvider, code: string, state: OAuthState, appleUser: string | null): Promise<ExternalIdentity | null> {
  const cfg = configOf(provider, process.env)
  if (!cfg) return null
  if (provider === 'MOCK') {
    // The mock "code" is the e-mail typed on the local page (dev/CI only).
    const email = normalizeEmail(code)
    if (!email) return null
    return { provider, providerUserId: `mock:${email}`, email, emailVerified: true, name: email.split('@')[0] }
  }
  const redirectUri = redirectUriOf(provider)
  const base = { client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }
  const tokens = await postForm(TOKEN_URL[provider], provider === 'GOOGLE' || provider === 'LINKEDIN' ? { ...base, code_verifier: state.verifier } : base)
  if (!tokens) return null
  const idToken = str(tokens.id_token), accessToken = str(tokens.access_token)
  if (provider === 'GOOGLE' || provider === 'APPLE' || provider === 'LINKEDIN') {
    const claims = idToken ? decodeJwtPayload(idToken) : null
    if (!claims || !str(claims.sub)) return null
    const verified = claims.email_verified === true || claims.email_verified === 'true'
    let name = str(claims.name)
    if (provider === 'APPLE' && !name && appleUser) {
      try { const u = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } }; name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ') || null } catch { /* ignore */ }
    }
    return { provider, providerUserId: str(claims.sub)!, email: normalizeEmail(str(claims.email) ?? ''), emailVerified: provider === 'APPLE' ? true : verified, name }
  }
  // FACEBOOK: no id_token on the server flow; read /me.
  if (!accessToken) return null
  const me = await getJson('https://graph.facebook.com/v19.0/me?fields=id,name,email', accessToken)
  if (!me || !str(me.id)) return null
  return { provider, providerUserId: str(me.id)!, email: normalizeEmail(str(me.email) ?? ''), emailVerified: true, name: str(me.name) }
}

export type OAuthOutcome =
  | { kind: 'session'; result: LoginResult; next: string | null; created: boolean }
  | { kind: 'no-account' }
  | { kind: 'no-email' }
  | { kind: 'inactive' }

/** Decides and acts: login, link + login, or create the account and login. */
export async function completeOAuth(identity: ExternalIdentity, state: OAuthState, ctx: { ip?: string; userAgent?: string }): Promise<OAuthOutcome> {
  const linkedRow = await prisma.userIdentity.findUnique({ where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.providerUserId } }, include: { user: { select: { id: true, active: true } } } })
  const byEmailRow = identity.email ? await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true, active: true } }) : null
  const d = decideOAuth({
    purpose: state.purpose,
    identity,
    linked: linkedRow ? { userId: linkedRow.user.id, active: linkedRow.user.active } : null,
    byEmail: byEmailRow ? { userId: byEmailRow.id, active: byEmailRow.active } : null,
    profileKind: state.profileKind,
    selfSignup: SELF_SIGNUP,
  })
  if (d.kind === 'no-account' || d.kind === 'no-email' || d.kind === 'inactive') return { kind: d.kind }
  if (d.kind === 'create') {
    const user = await createMemberAccount({ email: identity.email!, name: identity.name ?? identity.email!.split('@')[0], passwordHash: null, profileKind: d.profileKind as (typeof SELF_SIGNUP)[number], cpf: null, emailVerified: identity.emailVerified })
    await prisma.userIdentity.create({ data: { userId: user.id, provider: identity.provider, providerUserId: identity.providerUserId, email: identity.email } })
    return { kind: 'session', result: await openSession(user, ctx), next: state.next, created: true }
  }
  if (d.kind === 'link') {
    await prisma.userIdentity.create({ data: { userId: d.userId, provider: identity.provider, providerUserId: identity.providerUserId, email: identity.email } })
    if (identity.emailVerified) await prisma.user.updateMany({ where: { id: d.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } })
  }
  const user = await prisma.user.findUnique({ where: { id: d.userId } })
  if (!user || !user.active) return { kind: 'inactive' }
  return { kind: 'session', result: await openSession(user, ctx), next: state.next, created: false }
}

/** The social providers the login/signup pages may offer (only the configured ones). */
export { configuredProviders } from './core'
