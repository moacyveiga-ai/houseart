// Cobrança da casa — what the HouseArt team sees in "Cobrança" (audit
// 2026-10-25: the admin got "Sua conta não tem plano" and no revenue at all).
// Whole base on purpose: only staff (total scope) reaches it.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { diaNoFuso } from '@/lib/timezone'
import { INVOICE_STATUS_LABELS } from './server'

const d = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })
const KIND_LABELS: Record<string, string> = { PLAN: 'Plano', ORDER: 'Serviço', COMMISSION: 'Comissão' }

export interface HouseBilling {
  monthLabel: string
  revenueCents: bigint
  revenueByKind: { kind: string; label: string; cents: bigint }[]
  commissionHeldCents: bigint
  activePlans: number
  pastDuePlans: number
  payouts: { pendingCount: number; pendingCents: bigint; failed: { dealCode: string; party: string; amountCents: bigint; error: string }[] }
  invoices: { id: number; date: string; account: string; kind: string; description: string; amountCents: bigint; statusLabel: string }[]
}

const PARTY_LABELS: Record<string, string> = { ARTIST: 'Artista', GALLERY: 'Galeria', ARTIST_ROYALTY: 'Direito de sequência', ADVISOR: 'Consultor' }

export async function houseBilling(now = new Date()): Promise<HouseBilling> {
  return totalScope('billing:house', async () => {
    const month = diaNoFuso(now)!.slice(0, 7)
    const monthStart = new Date(`${month}-01T03:00:00.000Z`)
    const paid = { status: { in: ['PAID', 'HELD_IN_SPLIT'] } }
    const [byKind, held, activePlans, pastDuePlans, pending, failed, rows] = await Promise.all([
      prisma.invoice.groupBy({ by: ['kind'], where: { ...paid, date: { gte: monthStart } }, _sum: { amountCents: true } }),
      prisma.dealSplit.aggregate({ where: { party: 'PLATFORM', status: 'HELD' }, _sum: { amountCents: true } }),
      prisma.planSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.planSubscription.count({ where: { status: 'PAST_DUE' } }),
      prisma.dealSplit.aggregate({ where: { status: 'RELEASED', party: { in: ['ARTIST', 'GALLERY', 'ARTIST_ROYALTY', 'ADVISOR'] } }, _count: true, _sum: { amountCents: true } }),
      prisma.dealSplit.findMany({ where: { status: 'RELEASED', payoutError: { not: null } }, select: { party: true, amountCents: true, payoutError: true, deal: { select: { code: true } } }, orderBy: { id: 'desc' }, take: 20 }),
      prisma.invoice.findMany({ orderBy: { date: 'desc' }, take: 50 }),
    ])
    const tenants = await prisma.tenant.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.tenantId).filter((x): x is number => x !== null))] } }, select: { id: true, name: true } })
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.filter((r) => !r.tenantId && r.userId).map((r) => r.userId!))] } }, select: { id: true, name: true } })
    const tName = new Map(tenants.map((t) => [t.id, t.name]))
    const uName = new Map(users.map((u) => [u.id, u.name]))
    const revenueByKind = ['COMMISSION', 'PLAN', 'ORDER'].map((kind) => ({ kind, label: KIND_LABELS[kind], cents: byKind.find((k) => k.kind === kind)?._sum.amountCents ?? 0n }))
    return {
      monthLabel: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Bahia' }).format(now),
      revenueCents: revenueByKind.reduce((s, k) => s + k.cents, 0n),
      revenueByKind,
      commissionHeldCents: held._sum.amountCents ?? 0n,
      activePlans, pastDuePlans,
      payouts: {
        pendingCount: pending._count,
        pendingCents: pending._sum.amountCents ?? 0n,
        failed: failed.map((f) => ({ dealCode: f.deal.code, party: PARTY_LABELS[f.party] ?? f.party, amountCents: f.amountCents, error: f.payoutError ?? '' })),
      },
      invoices: rows.map((r) => ({
        id: r.id, date: d(r.date), account: (r.tenantId ? tName.get(r.tenantId) : r.userId ? uName.get(r.userId) : null) ?? '—',
        kind: KIND_LABELS[r.kind] ?? r.kind, description: r.description, amountCents: r.amountCents, statusLabel: INVOICE_STATUS_LABELS[r.status] ?? r.status,
      })),
    }
  })
}
