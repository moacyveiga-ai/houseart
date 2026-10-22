import { NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/auth'
import { startPasswordReset } from '@/lib/auth/access-code-server'
import { checkCodeRateLimit } from '@/lib/auth/login-rate-limit'
import { rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

/** Blind: the answer is the same whether or not the e-mail has an account. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = normalizeEmail(String(body.email ?? ''))
  if (!email) return NextResponse.json({ ok: false, error: 'Informe um e-mail válido.' }, { status: 400 })
  const brake = await checkCodeRateLimit({ ip: rawIpFromHeaders(req.headers), email })
  if (!brake.allowed) return rateLimitResponse(brake.decision, { ok: false, error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' })
  const r = await startPasswordReset(email)
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json({ ok: true, message: 'Se este e-mail tiver conta, enviamos um link para redefinir a senha.' })
}
