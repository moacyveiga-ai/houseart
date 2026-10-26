import { NextResponse } from 'next/server'
import { commentsOf } from '@/lib/community/server'
import { isCommentTarget } from '@/lib/community/domain'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { userOrNull } from '@/app/api/messages/_http'

export async function GET(req: Request) {
  try {
    const u = await userOrNull()
    const p = new URL(req.url).searchParams
    const target = p.get('target'), targetId = Number(p.get('targetId'))
    if (!isCommentTarget(target) || !Number.isInteger(targetId) || targetId <= 0) return NextResponse.json({ error: 'Alvo inválido.' }, { status: 400 })
    return NextResponse.json({ items: await commentsOf(u?.id ?? null, target, targetId) })
  } catch (e) { return artworkErrorResponse(e) }
}

