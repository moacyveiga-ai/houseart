import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { retryPublication } from '@/lib/instagram/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** "Tentar de novo" on a post that Instagram did not take. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ ok: false, error: 'Publicação inválida.' }, { status: 400 })
    await retryPublication(u.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
