import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeEmail } from '@/lib/auth'
import { startSignupCode } from '@/lib/auth/access-code-server'
import { passwordProblem } from '@/lib/auth/password-policy'
import { checkCodeRateLimit } from '@/lib/auth/login-rate-limit'
import { rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

const schema = z.object({
  email: z.string(),
  name: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(200),
  profileKind: z.enum(['ARTIST', 'GALLERY', 'ADVISOR', 'COLLECTOR']),
  cpf: z.string().optional(),
})

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
  const email = normalizeEmail(parsed.data.email)
  if (!email) return NextResponse.json({ ok: false, error: 'Informe um e-mail válido.' }, { status: 400 })
  const problem = passwordProblem(parsed.data.password)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  const brake = await checkCodeRateLimit({ ip: rawIpFromHeaders(req.headers), email })
  if (!brake.allowed) return rateLimitResponse(brake.decision, { ok: false, error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' })
  const r = await startSignupCode(email, { name: parsed.data.name, password: parsed.data.password, profileKind: parsed.data.profileKind, cpf: parsed.data.cpf ?? null })
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json({ ok: true, token: r.token, message: 'Enviamos um código para o seu e-mail.', ...(r.echo ? { echo: r.echo } : {}) })
}
