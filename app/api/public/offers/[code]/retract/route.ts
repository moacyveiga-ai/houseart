import { NextResponse } from 'next/server'
import { retractOffer } from '@/lib/offers/server'

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase()
  const body = await req.json().catch(() => ({})) as { token?: string }
  const ok = await retractOffer(code, String(body.token ?? ''))
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
