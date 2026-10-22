import { NextResponse } from 'next/server'
import { resendCode } from '@/lib/auth/access-code-server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { token?: string }
  const token = String(body.token ?? '')
  if (!token) return NextResponse.json({ ok: false }, { status: 400 })
  const r = await resendCode(token)
  return NextResponse.json({ ok: true, ...(r.echo ? { echo: r.echo } : {}) })
}
