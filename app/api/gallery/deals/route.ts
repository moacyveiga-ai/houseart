import { sellerDeals } from '@/lib/deals/server'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/**
 * "Vendas até o repasse" for the mobile app: the seller's deals with their
 * phases, split and shipping — the `DealView` the web `DealTimeline` reads
 * (BigInt as string). 404 without FLAG_DEALS, like the other deal routes.
 */
export async function GET() {
  const gate = flagGate('FLAG_DEALS'); if (gate) return gate
  const s = await gallerySession(); if (isResponse(s)) return s
  try { return json({ ok: true, deals: await sellerDeals(s.scope) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}
