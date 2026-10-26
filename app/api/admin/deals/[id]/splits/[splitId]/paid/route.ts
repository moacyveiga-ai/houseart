// Admin › Negócios: the desk marks a released split line as paid by hand (Pix outside the Stripe).
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { markSplitPaidManually } from '@/lib/admin-deals/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string; splitId: string }> }) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u)) return NextResponse.json({ error: 'Só a equipe da HouseArt registra repasses.' }, { status: 403 })
    const p = await ctx.params
    const id = idParam(p.id); const splitId = idParam(p.splitId)
    if (!id || !splitId) return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { note?: unknown }
    return NextResponse.json({ ok: true, ...(await markSplitPaidManually(id, splitId, body.note, { userId: u.id, name: u.name, ...requestContext(req) })) })
  } catch (e) { return artworkErrorResponse(e) }
}
