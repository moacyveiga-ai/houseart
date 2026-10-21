import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { unlistArtwork } from '@/lib/offers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    await unlistArtwork(scope, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
