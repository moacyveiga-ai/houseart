import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { deletePost } from '@/lib/community/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 })
    await deletePost(u.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
