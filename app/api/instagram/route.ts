import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { disconnect, instagramView, updatePrefs } from '@/lib/instagram/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** The person's Instagram: connection, preferences and the posts sent (never the token). */
export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, ...(await instagramView(u.id)) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}

export async function PATCH(req: Request) {
  try {
    const u = await requireAuth()
    await updatePrefs(u.id, (await req.json().catch(() => ({}))) as Record<string, unknown>)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}

export async function DELETE() {
  try { const u = await requireAuth(); await disconnect(u.id); return NextResponse.json({ ok: true }) } catch (e) { return artworkErrorResponse(e) }
}
