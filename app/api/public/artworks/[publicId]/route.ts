import { NextResponse } from 'next/server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { userOrNull } from '@/app/api/messages/_http'

export const dynamic = 'force-dynamic'

/**
 * The public page of one artwork as JSON (handoff "HouseArt Obra" / App
 * Colecionador › Página da obra): the same projection of `app/e/artwork/[publicId]`
 * — nothing of the mandate, nothing of the owner's document. With a session,
 * the viewer's liked/saved flags ride along.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  try {
    const publicId = (await ctx.params).publicId.toUpperCase()
    if (!isPublicId(publicId)) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const a = await publicArtwork(publicId)
    if (!a) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const u = await userOrNull()
    const f = (await artworkFlags(u?.id ?? null, [a.id])).get(a.id)
    return json({ ...a, liked: f?.liked ?? false, saved: f?.saved ?? false }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
