import { NextResponse } from 'next/server'
import { completeOAuth, resolveIdentity, takeState } from '@/lib/auth/oauth/server'
import { providerOfSlug } from '@/lib/auth/oauth/core'
import { COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { recordAudit } from '@/lib/audit'
import { publicBaseUrl } from '@/lib/public-url'

/** Where the person lands after the provider answers. Errors go back to the page that started, with `?social=`. */
function landing(path: string, params: Record<string, string>): NextResponse {
  const u = new URL(path, publicBaseUrl())
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return NextResponse.redirect(u.toString(), 302)
}

async function handle(req: Request, providerSlug: string, params: URLSearchParams, appleUser: string | null) {
  const provider = providerOfSlug(providerSlug)
  if (!provider) return landing('/login', { social: 'provider' })
  const nonce = params.get('state') ?? ''
  const state = await takeState(provider, nonce)
  if (!state) return landing('/login', { social: 'state' })
  const back = state.purpose === 'signup' ? '/signup' : '/login'
  const carry: Record<string, string> = state.plan ? { plan: state.plan } : {}
  if (params.get('error')) return landing(back, { ...carry, social: 'denied' })
  const code = params.get('code') ?? ''
  if (!code) return landing(back, { ...carry, social: 'denied' })
  const identity = await resolveIdentity(provider, code, state, appleUser)
  if (!identity) return landing(back, { ...carry, social: 'failed' })
  const ip = rawIpFromHeaders(req.headers)
  const ctx = { ip: ip === 'no-ip' ? undefined : ip, userAgent: req.headers.get('user-agent') ?? undefined }
  const out = await completeOAuth(identity, state, ctx)
  if (out.kind === 'no-account') return landing('/signup', { ...carry, social: 'no-account', provider: provider.toLowerCase() })
  if (out.kind === 'no-email') return landing(back, { ...carry, social: 'no-email' })
  if (out.kind === 'inactive') return landing('/login', { social: 'inactive' })
  if (!out.result.ok) return landing(back, { ...carry, social: 'failed' })
  void recordAudit({ entity: 'auth', entityId: out.result.user.id, action: out.created ? 'signup_social' : 'login_social', userId: out.result.user.id, userName: out.result.user.name, ip: ctx.ip, userAgent: ctx.userAgent, origin: 'api' })
  const target = out.created ? `/signup/welcome${state.plan ? `?plan=${encodeURIComponent(state.plan)}` : ''}` : (out.next ?? '/profiles')
  const res = NextResponse.redirect(new URL(target, publicBaseUrl()).toString(), 302)
  res.cookies.set(COOKIE_NAME, out.result.token, sessionCookieOptions())
  return res
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  return handle(req, (await ctx.params).provider, new URL(req.url).searchParams, null)
}

/** Apple answers with form_post (code, state, and `user` on the first consent). */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const form = await req.formData().catch(() => null)
  const params = new URLSearchParams()
  let appleUser: string | null = null
  if (form) for (const [k, v] of form.entries()) { if (typeof v === 'string') { if (k === 'user') appleUser = v; else params.set(k, v) } }
  return handle(req, (await ctx.params).provider, params, appleUser)
}
