import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { signOutDevice } from '@/lib/auth/devices-server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

/** Perfil › Aparelhos conectados: ends one OTHER session of the person. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Aparelho não encontrado.' }, { status: 404 })
    await signOutDevice(u.id, u.sessionId, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
