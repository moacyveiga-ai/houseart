import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { reportConversation } from '@/lib/messaging/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '../../_http'

/** Denunciar a outra pessoa da conversa: vai à fila de revisão da equipe. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    const limited = await socialWriteLimit(u.id, 'report'); if (limited) return limited
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown; note?: unknown }
    return NextResponse.json({ ok: true, ...(await reportConversation(u.id, id, body)) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
