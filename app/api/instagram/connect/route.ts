import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { beginConnect } from '@/lib/instagram/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** "Conectar com Instagram": the authorization URL (the state goes in an httpOnly cookie). */
export async function POST() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, url: await beginConnect(u.id) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}
