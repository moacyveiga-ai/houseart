import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { vote } from '@/lib/community/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Enquete não encontrada.' }, { status: 404 })
    const limited = await socialWriteLimit(u.id, 'vote'); if (limited) return limited
    const b = (await req.json().catch(() => ({}))) as { option?: unknown }
    if (typeof b.option !== 'number') return NextResponse.json({ error: 'Opção inválida.' }, { status: 400 })
    await vote(u.id, id, b.option)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
