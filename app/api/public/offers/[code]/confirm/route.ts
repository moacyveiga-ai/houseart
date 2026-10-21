import { NextResponse } from 'next/server'
import { confirmPublicOffer } from '@/lib/offers/server'

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase()
  const body = await req.json().catch(() => ({})) as { otp?: string }
  const r = await confirmPublicOffer(code, String(body.otp ?? ''))
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  // The retraction token is handed ONCE: it is the buyer's key to /e/offer/[code].
  return NextResponse.json({ ok: true, code, token: r.retractionToken, href: `/e/offer/${code}?t=${r.retractionToken}` }, { headers: { 'cache-control': 'no-store' } })
}
