import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { listConversations, openConversation, openGalleryConversation } from '@/lib/messaging/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { socialWriteLimit } from './_http'

export async function GET(req: Request) {
  try {
    const u = await requireAuth()
    const q = new URL(req.url).searchParams.get('q')
    return NextResponse.json({ items: await listConversations(u.id, q) })
  } catch (e) { return artworkErrorResponse(e) }
}

/** Opens (or finds) a conversation about an artwork — `{ artworkId }` —, with a user — `{ userId }` — or with a
 *  gallery by its public page — `{ gallery: slug }`. */
export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'open'); if (limited) return limited
    const body = (await req.json().catch(() => ({}))) as { artworkId?: unknown; userId?: unknown; gallery?: unknown }
    if (typeof body.gallery === 'string' && /^[a-z0-9-]{1,80}$/.test(body.gallery)) return NextResponse.json({ ok: true, id: await openGalleryConversation(u.id, body.gallery) })
    const artworkId = typeof body.artworkId === 'number' && Number.isInteger(body.artworkId) ? body.artworkId : null
    const other = typeof body.userId === 'number' && Number.isInteger(body.userId) ? body.userId : undefined
    if (artworkId == null && other == null) return NextResponse.json({ error: 'Informe a obra ou a pessoa.' }, { status: 400 })
    const id = await openConversation(u.id, artworkId, other)
    return NextResponse.json({ ok: true, id })
  } catch (e) { return artworkErrorResponse(e) }
}
