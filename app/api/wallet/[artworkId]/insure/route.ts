import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { insureArtwork } from '@/lib/collector-wallet/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function POST(_req: Request, ctx: { params: Promise<{ artworkId: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).artworkId)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const p = await insureArtwork(u.id, id)
    return NextResponse.json({ ok: true, insurer: p.insurer, policyNumber: p.policyNumber })
  } catch (e) { return artworkErrorResponse(e) }
}
