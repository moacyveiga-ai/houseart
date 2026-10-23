import { dayPanel } from '@/lib/gallery/panel-server'
import { listingsOf } from '@/lib/gallery/listing-server'
import { listArtworks } from '@/lib/artworks/server'
import { dateLabel } from '@/lib/dashboard/core'
import { initialsOf } from '@/lib/profiles/core'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/**
 * "Galeria · painel do dia" for the mobile app: the same data the web page
 * assembles for `DayPanel` (KPIs, "Precisa de você", the most viewed works of
 * the last 7 days) plus the header (date, name, initials). No prices beyond
 * the ones the KPIs already print; never the mandate.
 */
export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const now = new Date()
    const [data, listed] = await Promise.all([dayPanel(s.scope, now), listArtworks(s.scope, { filter: 'listed' })])
    const ls = listed.items.filter((a) => a.status === 'LISTED')
    const stats = await listingsOf(s.scope, ls.map((a) => a.id), now)
    const top: { id: number; title: string; coverUrl: string | null; views7d: number; openOffers: number }[] = []
    ls.forEach((a) => { const l = stats.get(a.id); if (l && l.stats.views7d > 0) top.push({ id: a.id, title: a.title, coverUrl: a.coverUrl, views7d: l.stats.views7d, openOffers: l.stats.openOffers }) })
    top.sort((x, y) => y.views7d - x.views7d)
    return json({ ok: true, panel: { dateLabel: dateLabel(now), name: s.user.name, initials: initialsOf(s.user.name), kpis: data.kpis, actions: data.actions, top: top.slice(0, 3) } }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
