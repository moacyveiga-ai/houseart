import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { startPhoneCode } from '@/lib/auth/access-code-server'
import { checkCodeRateLimit } from '@/lib/auth/login-rate-limit'
import { rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

export async function POST(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({})) as { phone?: string }
  const brake = await checkCodeRateLimit({ ip: rawIpFromHeaders(req.headers), email: `phone:${user.id}` })
  if (!brake.allowed) return rateLimitResponse(brake.decision, { ok: false, error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' })
  const r = await startPhoneCode(user.id, String(body.phone ?? ''))
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json({ ok: true, token: r.token, phoneMask: r.phoneMask, ...(r.echo ? { echo: r.echo } : {}) })
}
