import { dashboardCounts } from '@/lib/dashboard/server'
import { dateLabel, kpisFor, nextActionsFor } from '@/lib/dashboard/core'
import { listArtworks } from '@/lib/artworks/server'
import { initialsOf } from '@/lib/profiles/core'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '@/app/api/gallery/_http'

export const dynamic = 'force-dynamic'

/**
 * "Início do artista" for the mobile app (handoff "HouseArt App Artista" ›
 * Início): the header (date, name, initials), the four KPIs and the next
 * actions the web home builds (`lib/dashboard`), and the recent works of the
 * scope. Only the public price of the work; never the mandate.
 */
export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const now = new Date()
    const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/Bahia' }).format(now))
    const [counts, recent] = await Promise.all([dashboardCounts(s.scope, now), listArtworks(s.scope, { take: 6 })])
    const works = recent.items.map((a) => ({ id: a.id, title: a.title, year: a.year, artistName: a.artistName, status: a.status, publicId: a.publicId, coverUrl: a.coverUrl }))
    return json({ ok: true, home: { dateLabel: dateLabel(now), name: s.user.name, initials: initialsOf(s.user.name), kpis: kpisFor('artist', counts, year), actions: nextActionsFor(counts), recent: works } }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
