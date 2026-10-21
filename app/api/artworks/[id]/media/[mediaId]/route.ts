import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { deleteMedia } from '@/lib/artworks/media-server'
import { artworkErrorResponse, idParam } from '../../../_http'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const { scope } = await requirePanel()
    const p = await ctx.params
    const id = idParam(p.id), mediaId = idParam(p.mediaId)
    if (!id || !mediaId) return NextResponse.json({ error: 'Mídia não encontrada.' }, { status: 404 })
    await deleteMedia(scope, id, mediaId)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
