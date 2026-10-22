import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { retractOffer } from '@/lib/offers/server'

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase()
  const body = await req.json().catch(() => ({})) as { token?: string }
  const session = body.token ? null : await getSession().catch(() => null)
  const ok = await retractOffer(code, body.token ? String(body.token) : session ? { userId: session.id } : null)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
