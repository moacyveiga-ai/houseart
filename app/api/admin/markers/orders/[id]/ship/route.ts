import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { shipOrder } from '@/lib/physical-markers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const user = await requireStaff()
    const id = idParam((await ctx.params).id)
    const body = await req.json().catch(() => ({})) as { batchId?: number }
    const batchId = idParam(String(body.batchId ?? ''))
    if (!id || !batchId) return NextResponse.json({ error: 'Pedido ou lote inválido.' }, { status: 400 })
    await shipOrder(id, batchId, { userId: user.id, name: user.name })
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
