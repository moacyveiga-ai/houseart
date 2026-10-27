import { NextResponse } from 'next/server'
import { openDealConversation } from '@/lib/deals/server'
import { socialWriteLimit } from '@/app/api/messages/_http'
import { artworkErrorResponse, dealContext } from '../../_http'

/** The buyer opens the conversation with who sold the artwork (Compras · "Falar com o vendedor"). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.side !== 'BUYER') return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    const limited = await socialWriteLimit(c.user.id, 'open'); if (limited) return limited
    return NextResponse.json({ ok: true, id: await openDealConversation(c.user.id, c.id) })
  } catch (e) { return artworkErrorResponse(e) }
}
