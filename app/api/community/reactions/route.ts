import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { toggleReaction } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'

/** Toggles like / save / rsvp / follow: `{ target, targetId, kind }`. */
export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'react'); if (limited) return limited
    const b = (await req.json().catch(() => ({}))) as { target?: unknown; targetId?: unknown; kind?: unknown }
    if (typeof b.target !== 'string' || typeof b.kind !== 'string' || typeof b.targetId !== 'number' || !Number.isInteger(b.targetId) || b.targetId <= 0) return NextResponse.json({ error: 'Reação inválida.' }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await toggleReaction(u.id, b.target, b.targetId, b.kind)) })
  } catch (e) { return artworkErrorResponse(e) }
}
