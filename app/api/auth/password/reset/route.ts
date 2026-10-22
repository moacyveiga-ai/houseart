import { NextResponse } from 'next/server'
import { completePasswordReset } from '@/lib/auth/access-code-server'
import { passwordProblem } from '@/lib/auth/password-policy'
import { recordAudit } from '@/lib/audit'
import { rawIpFromHeaders } from '@/lib/http/ip'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { token?: string; password?: string }
  const token = String(body.token ?? ''), password = String(body.password ?? '')
  if (!token) return NextResponse.json({ ok: false, error: 'Link inválido ou expirado. Peça um novo link.' }, { status: 400 })
  const problem = passwordProblem(password)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  const r = await completePasswordReset(token, password)
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  const ip = rawIpFromHeaders(req.headers)
  void recordAudit({ entity: 'auth', entityId: 'password', action: 'password_reset', ip: ip === 'no-ip' ? undefined : ip, userAgent: req.headers.get('user-agent') ?? undefined, origin: 'api' })
  return NextResponse.json({ ok: true })
}
