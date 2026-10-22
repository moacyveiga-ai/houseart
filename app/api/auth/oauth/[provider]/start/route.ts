import { NextResponse } from 'next/server'
import { beginOAuth } from '@/lib/auth/oauth/server'
import { OAUTH_PURPOSES, providerOfSlug, type OAuthPurpose } from '@/lib/auth/oauth/core'
import { safeNext } from '@/lib/auth/safe-next'

const PLANS = /^[a-z0-9_-]{1,40}$/i

/** GET /api/auth/oauth/[provider]/start?purpose=login|signup&profileKind=&plan=&next= → 302 to the provider. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const provider = providerOfSlug((await ctx.params).provider)
  if (!provider) return NextResponse.json({ ok: false, error: 'Provedor desconhecido.' }, { status: 404 })
  const sp = new URL(req.url).searchParams
  const purposeRaw = sp.get('purpose') ?? 'login'
  const purpose: OAuthPurpose = (OAUTH_PURPOSES as readonly string[]).includes(purposeRaw) ? (purposeRaw as OAuthPurpose) : 'login'
  const profileKind = sp.get('profileKind')?.toUpperCase() ?? null
  const planRaw = sp.get('plan')
  const r = await beginOAuth(provider, { purpose, profileKind: profileKind && /^[A-Z_]{3,20}$/.test(profileKind) ? profileKind : null, plan: planRaw && PLANS.test(planRaw) ? planRaw : null, next: safeNext(sp.get('next')) })
  if (!r.ok) return NextResponse.json(r, { status: 503 })
  return NextResponse.redirect(r.url, 302)
}
