import { NextResponse } from 'next/server'
import { payEscrow } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../_http'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    await payEscrow(c.user.id, c.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
