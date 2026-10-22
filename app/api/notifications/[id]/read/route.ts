import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { markRead } from '@/lib/notifications/server'
import { errorResponse } from '@/lib/auth/route'
import { idParam } from '@/app/api/artworks/_http'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Aviso não encontrado.' }, { status: 404 })
    await markRead(u.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
