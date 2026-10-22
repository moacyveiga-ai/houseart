import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { addComment } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'


export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'comment'); if (limited) return limited
    const b = (await req.json().catch(() => ({}))) as { target?: unknown; targetId?: unknown; body?: unknown }
    if (typeof b.target !== 'string' || typeof b.targetId !== 'number') return NextResponse.json({ error: 'Alvo inválido.' }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await addComment(u.id, b.target, b.targetId, b.body)) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
