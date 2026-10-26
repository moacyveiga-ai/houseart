import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { openOfferConversation } from '@/lib/offers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'

/** The seller opens the conversation with the proponent of an offer (offer card · "Conversar"). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope, user } = await requirePanel()
    const limited = await socialWriteLimit(user.id, 'open'); if (limited) return limited
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    return NextResponse.json({ ok: true, id: await openOfferConversation(scope, id, user.id) })
  } catch (e) { return artworkErrorResponse(e) }
}
