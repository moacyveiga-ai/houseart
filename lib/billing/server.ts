// Cobrança — the screen's loader: the plan, the month's usage bars and the
// "Faturas e notas fiscais" rows (plan charges, paid orders and the platform
// commission of each deal — HELD_IN_SPLIT until the deed is issued).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberFilter, tenantOfScope, type Scope } from '@/lib/scope/core'
import { availablePlans, usageOf, type PlanView } from '@/lib/plans/server'
import { MONTH_NAMES, priceLabel, type UsageBar } from '@/lib/plans/core'

export const INVOICE_STATUS_LABELS: Record<string, string> = { PAID: 'Paga', HELD_IN_SPLIT: 'Retida no split', OPEN: 'Em aberto', CANCELLED: 'Cancelada' }

export interface InvoiceRow { id: string; at: number; date: string; description: string; amountCents: bigint; status: string; statusLabel: string; fiscalDocumentRef: string | null }

export interface BillingView {
  plan: { code: string; name: string; description: string; priceLabel: string; priceCents: bigint } | null
  options: PlanView[]
  monthLabel: string
  bars: UsageBar[]
  invoices: InvoiceRow[]
}

const d = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })

/** Commission rows derived from the deals the scope reaches (PLATFORM part of the split). */
async function commissionRows(scope: Scope): Promise<InvoiceRow[]> {
  const deals = await prisma.deal.findMany({ where: { ...memberFilter(scope) }, include: { splits: { where: { party: 'PLATFORM' } }, artwork: { select: { title: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  return deals.flatMap((deal) => deal.splits.map((s) => ({ id: `commission-${s.id}`, at: (deal.completedAt ?? deal.createdAt).getTime(), date: d(deal.completedAt ?? deal.createdAt), description: `Comissão HouseArt · ${deal.code} · ${deal.artwork.title}`, amountCents: s.amountCents, status: s.status === 'RELEASED' ? 'PAID' : 'HELD_IN_SPLIT', statusLabel: s.status === 'RELEASED' ? 'Paga' : 'Retida no split', fiscalDocumentRef: null })))
}

export async function billingView(scope: Scope, userId: number, now = new Date()): Promise<BillingView> {
  const usage = await usageOf(scope, now)
  const tenantId = tenantOfScope(scope)
  const monthLocal = new Date(now.getTime() - 3 * 3_600_000)
  const where = tenantId ? { OR: [{ tenantId }, { userId }] } : { userId }
  const rows = await prisma.invoice.findMany({ where, orderBy: { date: 'desc' }, take: 100 })
  const invoices: InvoiceRow[] = rows.map((r) => ({ id: `invoice-${r.id}`, at: r.date.getTime(), date: d(r.date), description: r.description, amountCents: r.amountCents, status: r.status, statusLabel: INVOICE_STATUS_LABELS[r.status] ?? r.status, fiscalDocumentRef: r.fiscalDocumentRef }))
  const commissions = await commissionRows(scope)
  return {
    plan: usage ? { code: usage.plan.code, name: usage.plan.name, description: usage.plan.description, priceLabel: priceLabel(usage.plan.priceCents), priceCents: usage.plan.priceCents } : null,
    options: usage ? await availablePlans(usage.audience) : [],
    monthLabel: MONTH_NAMES[monthLocal.getUTCMonth()],
    bars: usage?.bars ?? [],
    invoices: [...invoices, ...commissions].sort((a, b) => b.at - a.at),
  }
}
