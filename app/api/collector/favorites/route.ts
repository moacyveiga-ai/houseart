import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { favoritesOf } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** Favoritos e curtidos of the viewer (the rows of `app/(panel)/favorites/page.tsx`), newest reaction first. */
export async function GET() {
  try {
    const u = await requireAuth()
    const rows = (await favoritesOf(u.id)).map((r) => ({ ...r, priceCents: r.priceCents === null ? null : r.priceCents.toString() }))
    return NextResponse.json({ items: rows }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
