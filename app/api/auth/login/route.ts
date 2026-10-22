import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/lib/auth'
import { checkLoginRateLimit, clearLoginRateLimit } from '@/lib/auth/login-rate-limit'
import { rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { recordAudit } from '@/lib/audit'
import { safeNext } from '@/lib/auth/safe-next'
import { sessionResponse } from '../_cookie'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { credential?: string; password?: string; next?: string; remember?: boolean }
  const credential = String(body.credential ?? '')
  const ip = rawIpFromHeaders(req.headers)
  const brake = await checkLoginRateLimit({ ip, credential })
  if (!brake.allowed) return rateLimitResponse(brake.decision, { ok: false, error: 'Muitas tentativas. Aguarde um pouco e tente de novo.' })
  const userAgent = req.headers.get('user-agent') ?? undefined
  const r = await loginWithPassword({ credential, password: String(body.password ?? ''), ip: ip === 'no-ip' ? undefined : ip, userAgent })
  if (!r.ok) {
    void recordAudit({ entity: 'auth', entityId: 'login', action: 'login_failed', ip: ip === 'no-ip' ? undefined : ip, userAgent, origin: 'api' })
    return NextResponse.json({ ok: false, error: r.error }, { status: 401 })
  }
  await clearLoginRateLimit(credential)
  void recordAudit({ entity: 'auth', entityId: r.user.id, action: 'login', userId: r.user.id, userName: r.user.name, ip: ip === 'no-ip' ? undefined : ip, userAgent, origin: 'api' })
  return sessionResponse(r.user, r.token, safeNext(body.next), body.remember !== false)
}
