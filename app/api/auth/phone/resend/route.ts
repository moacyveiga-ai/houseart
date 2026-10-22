import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { resendPhoneCode } from '@/lib/auth/access-code-server'

export async function POST(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({})) as { token?: string }
  const r = await resendPhoneCode(user.id, String(body.token ?? ''))
  return NextResponse.json(r)
}
