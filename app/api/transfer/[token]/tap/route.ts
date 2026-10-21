import { NextResponse } from 'next/server'
import { buyerTap } from '@/lib/ownership/server'

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const body = await req.json().catch(() => ({})) as { uid?: string; ctr?: number; cmac?: string }
  const sun = body.uid && typeof body.ctr === 'number' && body.cmac ? { uid: body.uid, ctr: body.ctr, cmac: body.cmac } : null
  const r = await buyerTap((await ctx.params).token, sun)
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
