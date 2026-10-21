// Direito de sequência — the artist's view (KPIs + table).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberOfScope, type Scope } from '@/lib/scope/core'
import { ROYALTY_STATUS_LABELS } from './core'

export async function royaltyView(scope: Scope, now = new Date()) {
  const memberId = memberOfScope(scope)
  const artist = memberId ? await prisma.artist.findUnique({ where: { memberId } }) : null
  if (!artist) return { kpis: { yearCents: 0n, pendingCents: 0n, resold: 0 }, rows: [] }
  const rows = await prisma.royaltyPayment.findMany({ where: { artistId: artist.id }, include: { artwork: { select: { title: true, year: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  const year = now.getUTCFullYear()
  const yearCents = rows.filter((r) => r.status === 'PAID' && r.paidAt && r.paidAt.getUTCFullYear() === year).reduce((a, r) => a + r.royaltyCents, 0n)
  const pendingCents = rows.filter((r) => r.status !== 'PAID').reduce((a, r) => a + r.royaltyCents, 0n)
  return {
    kpis: { yearCents, pendingCents, resold: rows.length },
    rows: rows.map((r) => ({ id: r.id, date: r.createdAt.toLocaleDateString('pt-BR'), title: `${r.artwork.title}`, saleCents: r.saleCents, appreciationCents: r.appreciationCents, royaltyCents: r.royaltyCents, status: ROYALTY_STATUS_LABELS[r.status] ?? r.status, paid: r.status === 'PAID' })),
  }
}
