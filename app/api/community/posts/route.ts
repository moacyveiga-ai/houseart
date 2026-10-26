import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createPost } from '@/lib/community/server'
import { requestPublication } from '@/lib/instagram/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '@/app/api/messages/_http'

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'post'); if (limited) return limited
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const post = await createPost(u.id, body)
    // "Publicar também no Instagram": the post is already in the community; Instagram goes after the response
    const ig = body.instagram as { on?: unknown; format?: unknown } | undefined
    const instagram = ig?.on === true ? await requestPublication(u.id, post.id, ig.format).catch(() => ({ error: 'Não foi possível enviar ao Instagram.' })) : null
    return NextResponse.json({ ok: true, ...post, instagram }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
