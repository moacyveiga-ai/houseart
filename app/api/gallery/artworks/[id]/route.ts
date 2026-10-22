import { NextResponse } from 'next/server'
import { getArtwork } from '@/lib/artworks/server'
import { listingOf } from '@/lib/gallery/listing-server'
import { rulesOf } from '@/lib/gallery/rules-server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../../_http'

export const dynamic = 'force-dynamic'

/**
 * The head of "Gestão do anúncio" for the mobile app: the artwork (title, year,
 * artist, certificate id, cover, status), its listing when it is for sale (the
 * `ListingView`: asked price, accepts offers, paused, views, open offers) and
 * the gallery rules the toggle text quotes. Out of scope = 404. The mandate's
 * reserve never leaves (`ListingView` does not carry it).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const id = idParam((await ctx.params).id)
    const a = id ? await getArtwork(s.scope, id) : null
    if (!a) return NextResponse.json({ ok: false, error: 'Obra não encontrada.' }, { status: 404 })
    const [listing, rules] = await Promise.all([
      listingOf(s.scope, a.id),
      rulesOf(s.scope).then((r) => ({ refuseBelowBps: r.refuseBelowBps, responseHours: r.responseHours })).catch(() => null),
    ])
    const cover = a.media.find((m) => m.kind === 'FRONT_COLOR_CARD')?.publicUrl ?? a.media[0]?.publicUrl ?? null
    return json({
      ok: true,
      artwork: { id: a.id, title: a.title, year: a.year, artistName: a.artist.name, publicId: a.publicId, coverUrl: cover, status: a.status },
      listing: listing ? { listPriceCents: listing.listPriceCents, acceptsOffers: listing.acceptsOffers, fixedPrice: listing.fixedPrice, paused: listing.paused, stats: listing.stats } : null,
      rules,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
