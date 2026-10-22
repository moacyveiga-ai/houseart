import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { buyerDeals } from '@/lib/deals/server'
import { simulatedSun } from '@/lib/physical-markers/server'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/**
 * Compras of the mobile app (App Colecionador › Acompanhar compra): the deals
 * where the logged person is the buyer — what `app/(panel)/purchases` shows.
 * The split of the values is the seller's business and does not come along.
 * `simulateAllowed` is the rule of `POST /api/markers/link` (a simulated tap is
 * accepted only with MARKER_VENDOR=mock outside production). 404 without FLAG_DEALS.
 */
export async function GET() {
  const gate = flagGate('FLAG_DEALS'); if (gate) return gate
  try {
    const u = await requireAuth()
    const deals = (await buyerDeals(u.id)).map(({ split: _split, ...d }) => d)
    return json({ ok: true, deals, simulateAllowed: simulatedSun('0'.repeat(14)) !== null }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 })
    return artworkErrorResponse(e)
  }
}
