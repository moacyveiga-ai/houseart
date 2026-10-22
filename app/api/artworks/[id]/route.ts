import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { getArtwork, patchArtwork } from '@/lib/artworks/server'
import { artworkPatchSchema } from '@/lib/artworks/input'
import { toArtworkDto } from '@/lib/artworks/dto-core'
import { artworkErrorResponse, idParam, json } from '../_http'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    const a = id ? await getArtwork(scope, id) : null
    if (!a) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    return json(toArtworkDto(a))
  } catch (e) { return artworkErrorResponse(e) }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const parsed = artworkPatchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.', issues: parsed.error.issues.map((i) => i.path.join('.')) }, { status: 400 })
    return json(toArtworkDto(await patchArtwork(scope, id, parsed.data)))
  } catch (e) { return artworkErrorResponse(e) }
}
