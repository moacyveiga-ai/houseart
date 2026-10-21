import { NextResponse } from 'next/server'
import { confirmDelivery } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../_http'

export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    const body = await req.json().catch(() => ({})) as { uid?: string; ctr?: number; cmac?: string }
    const sun = body.uid && typeof body.ctr === 'number' && body.cmac ? { uid: body.uid, ctr: body.ctr, cmac: body.cmac } : null
    await confirmDelivery(c.user.id, c.id, sun)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
