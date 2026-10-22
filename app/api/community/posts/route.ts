import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createPost } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'post'); if (limited) return limited
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json({ ok: true, ...(await createPost(u.id, body)) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
