import { NextResponse } from 'next/server'
import { buyerAcceptTransfer } from '@/lib/ownership/server'
import { consumeOrAllow, rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const brake = await consumeOrAllow({ key: `transfer:ip:${rawIpFromHeaders(req.headers)}`, limit: 20, windowMs: 3_600_000 })
  if (!brake.allowed) return rateLimitResponse(brake)
  const body = await req.json().catch(() => ({})) as { document?: string }
  const r = await buyerAcceptTransfer((await ctx.params).token, String(body.document ?? ''))
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
