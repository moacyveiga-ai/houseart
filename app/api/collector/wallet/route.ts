import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { walletOf } from '@/lib/collector-wallet/server'
import { heldArtworks } from '@/lib/ownership/server'
import { valuationOf } from '@/lib/collector-wallet/collection-server'
import { changeLabel, shownBps, valuationNote } from '@/lib/collector-wallet/valuation-core'
import { arrivingPurchases } from '@/lib/deals/server'
import { formatBRL } from '@/lib/artworks/domain'
import { ScopeNotApplied } from '@/lib/scope/extension-core'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/**
 * Minha coleção of the mobile app: the deeds the person holds (what
 * `app/(panel)/wallet/page.tsx` shows). No document mask, no hash: only what
 * the card prints.
 */
export async function GET() {
  try {
    const u = await requireAuth()
    const [w, held, arriving] = await Promise.all([walletOf(u.id), heldArtworks(u.id), arrivingPurchases(u.id)])
    // the web header's valuation (laudo or the artist's selling range); a failure only hides the KPI
    const v = await valuationOf(w.values).catch((e: unknown) => { if (e instanceof ScopeNotApplied) throw e; console.warn('[collection] valorização', (e as Error)?.name); return null })
    const byArtwork = new Map(held.map((v) => [v.certificate.artwork.id, v.certificate.artwork]))
    const items = w.items.map((it) => {
      const a = byArtwork.get(it.artworkId)
      return {
        artworkId: it.artworkId, publicId: it.publicId, title: it.title, artist: it.artist, cover: it.cover,
        acquiredAt: it.acquiredAt, priceLabel: it.priceLabel, insured: it.insured, holderName: it.holderName, version: it.version,
        status: a?.status ?? 'AUTHENTICATED', sealGreen: a?.seal === 'GREEN', registeredCents: a?.listPriceCents?.toString() ?? null,
        artistId: a?.artistId ?? null,
      }
    })
    const bps = v ? shownBps(v.changeBps) : 0
    const valuation = v ? { label: changeLabel(v.changeBps), tone: bps > 0 ? 'up' : bps < 0 ? 'down' : null, note: valuationNote(v, items.length, formatBRL) } : null
    return NextResponse.json({ items, totalCents: w.totalCents.toString(), holderName: u.name, valuation, arriving }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
