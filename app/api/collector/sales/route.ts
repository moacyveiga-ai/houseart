import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { collectorSales } from '@/lib/collectors/server'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/**
 * Vendas do colecionador (App Colecionador › Vendas › Em andamento): the deals
 * where the logged collector sells — the same `DealView` of
 * `GET /api/gallery/deals` (the seller's own deal, split included), so the app
 * signs the term and registers the shipping. 404 without FLAG_DEALS.
 */
export async function GET() {
  const gate = flagGate('FLAG_DEALS'); if (gate) return gate
  try {
    const u = await requireAuth()
    return json({ ok: true, deals: await collectorSales(u.id) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 })
    return artworkErrorResponse(e)
  }
}
