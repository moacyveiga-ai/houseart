import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { addressesOf, saveAddress } from '@/lib/addresses/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** The person's delivery addresses (only their own). */
export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, items: await addressesOf(u.id) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    return NextResponse.json({ ok: true, address: await saveAddress(u.id, (await req.json().catch(() => ({}))) as Record<string, unknown>) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
