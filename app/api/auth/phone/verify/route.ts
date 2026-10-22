import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { verifyPhoneCode } from '@/lib/auth/access-code-server'

export async function POST(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({})) as { token?: string; code?: string }
  const token = String(body.token ?? ''), code = String(body.code ?? '').replace(/\D/g, '')
  if (!token || !code) return NextResponse.json({ ok: false, error: 'Informe o código.' }, { status: 400 })
  const r = await verifyPhoneCode(user.id, token, code)
  if (!r.ok) return NextResponse.json(r, { status: 401 })
  return NextResponse.json(r)
}
