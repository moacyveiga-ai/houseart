import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { savePhoneUnverified } from '@/lib/auth/access-code-server'

/** Signup step "Seu celular": stores the number without a code (the e-mail code is the only check of the signup). */
export async function POST(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({})) as { phone?: string }
  const r = await savePhoneUnverified(user.id, String(body.phone ?? ''))
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json({ ok: true, phoneMask: r.phoneMask })
}
