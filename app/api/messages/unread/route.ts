import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { unreadMessages } from '@/lib/messaging/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

/** The badge of the Mensagens tab: the sum of unread messages of the logged person. */
export async function GET() {
  try {
    const u = await requireAuth()
    return NextResponse.json({ unread: await unreadMessages(u.id) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
