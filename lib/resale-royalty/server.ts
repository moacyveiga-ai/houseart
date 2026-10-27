// Direito de sequência — the artist's view (KPIs + table).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberOfScope, type Scope } from '@/lib/scope/core'
import { dataBR, diaNoFuso, instanteDoDia } from '@/lib/timezone'
import { ROYALTY_STATUS_LABELS } from './core'

/** The year of the house (America/Bahia) and its bounds — never the UTC year (rule 11). */
function houseYear(now: Date): { year: number; from: Date; to: Date } {
  const year = Number((diaNoFuso(now) ?? now.toISOString()).slice(0, 4))
  return { year, from: new Date(instanteDoDia(`${year}-01-01`, 0)!), to: new Date(instanteDoDia(`${year + 1}-01-01`, 0)!) }
}

export async function royaltyView(scope: Scope, now = new Date()) {
  const memberId = memberOfScope(scope)
  const artist = memberId ? await prisma.artist.findUnique({ where: { memberId } }) : null
  const { year, from, to } = houseYear(now)
  if (!artist) return { year, kpis: { yearCents: 0n, pendingCents: 0n, resold: 0 }, rows: [] }
  // the KPIs are aggregates of every payment, not of the 100 rows the table shows
  const [rows, paidYear, pending, resold] = await Promise.all([
    prisma.royaltyPayment.findMany({ where: { artistId: artist.id }, include: { artwork: { select: { title: true, year: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.royaltyPayment.aggregate({ where: { artistId: artist.id, status: 'PAID', paidAt: { gte: from, lt: to } }, _sum: { royaltyCents: true } }),
    prisma.royaltyPayment.aggregate({ where: { artistId: artist.id, status: { not: 'PAID' } }, _sum: { royaltyCents: true } }),
    prisma.royaltyPayment.groupBy({ by: ['artworkId'], where: { artistId: artist.id } }),
  ])
  return {
    year,
    kpis: { yearCents: paidYear._sum.royaltyCents ?? 0n, pendingCents: pending._sum.royaltyCents ?? 0n, resold: resold.length },
    rows: rows.map((r) => ({ id: r.id, date: dataBR(r.createdAt), title: r.artwork.title, artworkYear: r.artwork.year, cover: r.artwork.media[0]?.publicUrl ?? null, saleCents: r.saleCents, appreciationCents: r.appreciationCents, royaltyCents: r.royaltyCents, status: ROYALTY_STATUS_LABELS[r.status] ?? r.status, paid: r.status === 'PAID' })),
  }
}
