import { dealReceiptPdf } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../_http'

/** "Baixar comprovante": the PDF of a completed deal, for the buyer or the seller (the side decides the content). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    const r = await dealReceiptPdf(c.id, c.side, { userId: c.user.id, scope: c.scope })
    return new Response(Buffer.from(r.pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${r.filename}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } catch (e) { return artworkErrorResponse(e) }
}
