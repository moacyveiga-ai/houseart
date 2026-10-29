import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { resendEmailChange } from '@/lib/auth/access-code-server'
import { checkCodeRateLimit } from '@/lib/auth/login-rate-limit'
import { rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

/** Reenvia o código da troca de e-mail: o mesmo freio do pedido (por IP e por conta), além dos 3 reenvios por código. */
export async function POST(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const brake = await checkCodeRateLimit({ ip: rawIpFromHeaders(req.headers), email: `email-change:${user.id}` })
  if (!brake.allowed) return rateLimitResponse(brake.decision, { ok: false, error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' })
  const body = await req.json().catch(() => ({})) as { token?: string }
  return NextResponse.json(await resendEmailChange(user.id, String(body.token ?? '')))
}
