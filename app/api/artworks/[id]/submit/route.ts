import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { submitForCertification } from '@/lib/artworks/server'
import { artworkErrorResponse, idParam, json } from '../../_http'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    return json(await submitForCertification(scope, id, { userId: user.id, name: user.name }))
  } catch (e) { return artworkErrorResponse(e) }
}
