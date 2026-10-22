import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { readArtworkPhotos } from '@/lib/artworks/reading-server'
import { artworkErrorResponse, idParam } from '../../_http'

export const maxDuration = 60

/** "Preencher com as fotos": the model reads front/signature/back and fills the EMPTY sheet fields. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    return NextResponse.json(await readArtworkPhotos(scope, id), { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
