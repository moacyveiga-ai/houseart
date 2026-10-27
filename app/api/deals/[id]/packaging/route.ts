// "Registrar embalagem e condition report": the seller's note on the packed work (with its photos).
import { NextResponse } from 'next/server'
import { recordPackaging } from '@/lib/deals/packaging-server'
import { artworkErrorResponse, dealContext } from '../../_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.side !== 'SELLER' || !c.scope) return NextResponse.json({ error: 'Só o vendedor registra a embalagem.' }, { status: 403 })
    const body = await req.json().catch(() => ({})) as { report?: unknown }
    await recordPackaging(c.scope, c.id, body.report, c.user.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
