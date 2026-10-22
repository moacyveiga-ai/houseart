import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { orderArtworkService } from '@/lib/collectors/server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'

/** Orders one catalog service for an artwork the person owns: `{ code }`. Quotes return `{ quote: true }`. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const b = (await req.json().catch(() => ({}))) as { code?: unknown }
    if (typeof b.code !== 'string') return NextResponse.json({ error: 'Escolha o serviço.' }, { status: 400 })
    return json({ ok: true, ...(await orderArtworkService(u.id, id, b.code)) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
