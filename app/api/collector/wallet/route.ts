import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { walletOf } from '@/lib/collector-wallet/server'
import { heldArtworks } from '@/lib/ownership/server'
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
    const [w, held] = await Promise.all([walletOf(u.id), heldArtworks(u.id)])
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
    return NextResponse.json({ items, totalCents: w.totalCents.toString(), holderName: u.name }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
