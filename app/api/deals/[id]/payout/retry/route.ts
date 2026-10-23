import { NextResponse } from 'next/server'
import { retryDealPayout } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../../_http'

/** Pays now the RELEASED lines of a completed deal (the seller of the deal, or the team by its total scope). The buyer never. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.side !== 'SELLER') return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true, ...(await retryDealPayout(c.id)) })
  } catch (e) { return artworkErrorResponse(e) }
}
