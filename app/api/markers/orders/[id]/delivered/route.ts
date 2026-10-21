import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { confirmDelivery } from '@/lib/physical-markers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    await confirmDelivery(scope, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
