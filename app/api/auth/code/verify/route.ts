import { NextResponse } from 'next/server'
import { verifyAccessCode } from '@/lib/auth/access-code-server'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { safeNext } from '@/lib/auth/safe-next'
import { sessionResponse } from '../../_cookie'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { token?: string; code?: string; next?: string }
  const token = String(body.token ?? '')
  const code = String(body.code ?? '').replace(/\D/g, '')
  if (!token || !code) return NextResponse.json({ ok: false, error: 'Informe o código.' }, { status: 400 })
  const ip = rawIpFromHeaders(req.headers)
  const r = await verifyAccessCode(token, code, { ip: ip === 'no-ip' ? undefined : ip, userAgent: req.headers.get('user-agent') ?? undefined })
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 401 })
  return sessionResponse(r.user, r.token, safeNext(body.next))
}
