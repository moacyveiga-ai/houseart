// OAuth / social login — PURE decisions (no I/O, no env read outside the
// slice it receives). Providers: Google, Apple, Facebook, LinkedIn, and MOCK
// (dev/CI only: a local page that "logs in" any e-mail, never in production).
import { createHash, randomBytes } from 'node:crypto'

export const OAUTH_PROVIDERS = ['GOOGLE', 'APPLE', 'FACEBOOK', 'LINKEDIN', 'MOCK'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

/** URL slug ↔ provider key. */
export function providerOfSlug(slug: string): OAuthProvider | null {
  const up = slug.trim().toUpperCase()
  return (OAUTH_PROVIDERS as readonly string[]).includes(up) ? (up as OAuthProvider) : null
}

export const OAUTH_PURPOSES = ['login', 'signup'] as const
export type OAuthPurpose = (typeof OAUTH_PURPOSES)[number]

/** What the start route stows in the state cookie and gets back in the callback. */
export interface OAuthState {
  nonce: string
  provider: OAuthProvider
  purpose: OAuthPurpose
  /** chosen profile on the Cadastro page (ignored on login) */
  profileKind: string | null
  /** plan chosen on the Cadastro page (`?plan=`), carried to the next step */
  plan: string | null
  next: string | null
  /** PKCE verifier (Google, LinkedIn accept it; harmless elsewhere) */
  verifier: string
  issuedAt: number
}

export const STATE_TTL_MS = 10 * 60_000
export const STATE_COOKIE = 'houseart_oauth'

export function newNonce(): string { return randomBytes(16).toString('base64url') }
export function newVerifier(): string { return randomBytes(32).toString('base64url') }
export function challengeOf(verifier: string): string { return createHash('sha256').update(verifier).digest('base64url') }

export function stateFresh(s: OAuthState, now: number): boolean {
  return now - s.issuedAt >= 0 && now - s.issuedAt <= STATE_TTL_MS
}

export interface ProviderConfig {
  clientId: string
  clientSecret: string
}

/** Which providers are configured in this env (MOCK only outside production). */
export function configuredProviders(env: Record<string, string | undefined>): OAuthProvider[] {
  const out: OAuthProvider[] = []
  if (env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET) out.push('GOOGLE')
  if (env.OAUTH_APPLE_CLIENT_ID && env.OAUTH_APPLE_CLIENT_SECRET) out.push('APPLE')
  if (env.OAUTH_FACEBOOK_CLIENT_ID && env.OAUTH_FACEBOOK_CLIENT_SECRET) out.push('FACEBOOK')
  if (env.OAUTH_LINKEDIN_CLIENT_ID && env.OAUTH_LINKEDIN_CLIENT_SECRET) out.push('LINKEDIN')
  if (mockAllowed(env)) out.push('MOCK')
  return out
}

export function mockAllowed(env: Record<string, string | undefined>): boolean {
  return env.OAUTH_MOCK === '1' && env.NODE_ENV !== 'production' && env.VERCEL_ENV !== 'production'
}

export function configOf(provider: OAuthProvider, env: Record<string, string | undefined>): ProviderConfig | null {
  if (provider === 'MOCK') return mockAllowed(env) ? { clientId: 'mock', clientSecret: 'mock' } : null
  // Explicit names (the env ratchet forbids computed reads).
  const pair: Record<Exclude<OAuthProvider, 'MOCK'>, [string | undefined, string | undefined]> = {
    GOOGLE: [env.OAUTH_GOOGLE_CLIENT_ID, env.OAUTH_GOOGLE_CLIENT_SECRET],
    APPLE: [env.OAUTH_APPLE_CLIENT_ID, env.OAUTH_APPLE_CLIENT_SECRET],
    FACEBOOK: [env.OAUTH_FACEBOOK_CLIENT_ID, env.OAUTH_FACEBOOK_CLIENT_SECRET],
    LINKEDIN: [env.OAUTH_LINKEDIN_CLIENT_ID, env.OAUTH_LINKEDIN_CLIENT_SECRET],
  }
  const [id, secret] = pair[provider]
  return id && secret ? { clientId: id, clientSecret: secret } : null
}

const AUTHORIZE: Record<Exclude<OAuthProvider, 'MOCK'>, { url: string; scope: string; extra?: Record<string, string> }> = {
  GOOGLE: { url: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'openid email profile', extra: { access_type: 'online', prompt: 'select_account' } },
  APPLE: { url: 'https://appleid.apple.com/auth/authorize', scope: 'name email', extra: { response_mode: 'form_post' } },
  FACEBOOK: { url: 'https://www.facebook.com/v19.0/dialog/oauth', scope: 'email public_profile' },
  LINKEDIN: { url: 'https://www.linkedin.com/oauth/v2/authorization', scope: 'openid profile email' },
}

export const TOKEN_URL: Record<Exclude<OAuthProvider, 'MOCK'>, string> = {
  GOOGLE: 'https://oauth2.googleapis.com/token',
  APPLE: 'https://appleid.apple.com/auth/token',
  FACEBOOK: 'https://graph.facebook.com/v19.0/oauth/access_token',
  LINKEDIN: 'https://www.linkedin.com/oauth/v2/accessToken',
}

/** The provider's authorization URL for this state. MOCK goes to the local mock page. */
export function authorizeUrl(provider: OAuthProvider, cfg: ProviderConfig, redirectUri: string, state: OAuthState, baseUrl: string): string {
  if (provider === 'MOCK') {
    const u = new URL('/api/auth/oauth/mock/authorize', baseUrl)
    u.searchParams.set('state', state.nonce)
    u.searchParams.set('redirect_uri', redirectUri)
    return u.toString()
  }
  const a = AUTHORIZE[provider]
  const u = new URL(a.url)
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', a.scope)
  u.searchParams.set('state', state.nonce)
  if (provider === 'GOOGLE' || provider === 'LINKEDIN') {
    u.searchParams.set('code_challenge', challengeOf(state.verifier))
    u.searchParams.set('code_challenge_method', 'S256')
  }
  for (const [k, v] of Object.entries(a.extra ?? {})) u.searchParams.set(k, v)
  return u.toString()
}

/** The identity the callback resolves, whatever the provider. */
export interface ExternalIdentity {
  provider: OAuthProvider
  providerUserId: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

/** Decodes the payload of a JWT WITHOUT verifying (the token came straight from the provider's token endpoint over TLS). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown> } catch { return null }
}

/** Decision after the identity is known. */
export type OAuthDecision =
  | { kind: 'login'; userId: number }
  | { kind: 'link'; userId: number }                 // same verified e-mail, no identity yet → link and log in
  | { kind: 'create'; profileKind: string }           // signup with a chosen profile
  | { kind: 'no-account' }                           // login of an unknown e-mail → go sign up
  | { kind: 'no-email' }                             // provider gave no e-mail → cannot create
  | { kind: 'inactive' }

export function decideOAuth(input: {
  purpose: OAuthPurpose
  identity: ExternalIdentity
  linked: { userId: number; active: boolean } | null
  byEmail: { userId: number; active: boolean } | null
  profileKind: string | null
  selfSignup: readonly string[]
}): OAuthDecision {
  if (input.linked) return input.linked.active ? { kind: 'login', userId: input.linked.userId } : { kind: 'inactive' }
  if (!input.identity.email) return { kind: 'no-email' }
  if (input.byEmail) {
    if (!input.byEmail.active) return { kind: 'inactive' }
    // Only a provider-verified e-mail may adopt an existing account (otherwise anyone could register "victim@x" at a lax IdP).
    return input.identity.emailVerified ? { kind: 'link', userId: input.byEmail.userId } : { kind: 'no-account' }
  }
  if (input.purpose === 'signup' && input.profileKind && input.selfSignup.includes(input.profileKind)) return { kind: 'create', profileKind: input.profileKind }
  return { kind: 'no-account' }
}
