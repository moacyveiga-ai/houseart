// Carteira e cartões › saldos e Movimentações (handoff "HouseArt App Colecionador" › carteira) — PURE.
// "Em garantia": what the person paid into the guarantee of purchases still in course. "A receber":
// their own split lines of sales already paid by the buyer and not yet transferred. Movements: completed
// purchases, released pre-authorizations of offers and sales paid out, newest first.
import { formatBRL } from '@/lib/artworks/domain'

export interface PurchaseFact { id: number; code: string; title: string; totalCents: bigint; paidAt: Date | null; completedAt: Date | null; cancelled: boolean }
export interface ReleasedHoldFact { id: number; code: string; title: string; amountCents: bigint; at: Date }
export interface SaleLineFact { id: number; dealId: number; dealCode: string; title: string; amountCents: bigint; status: string; buyerPaid: boolean; transferredAt: Date | null; cancelled: boolean }

/**
 * What the guarantee of a deal actually charged: buy-now and direct escrow charge price + shipping +
 * insurance; a deal born from an offer whose hold was captured (`escrowPaymentRef` = `<hold>:captured`,
 * lib/deals/server.ts createDealFromOffer) charged only the accepted price.
 */
export function escrowChargedCents(d: { amountCents: bigint; shippingCents: bigint; insuranceCents: bigint; escrowPaymentRef: string | null; offerHoldRef: string | null }): bigint {
  return d.offerHoldRef && d.escrowPaymentRef === `${d.offerHoldRef}:captured` ? d.amountCents : d.amountCents + d.shippingCents + d.insuranceCents
}

export interface WalletBalances { inEscrowCents: bigint; inEscrowCount: number; receivableCents: bigint; receivableCount: number }

const inEscrow = (p: PurchaseFact) => !!p.paidAt && !p.completedAt && !p.cancelled
const receivable = (l: SaleLineFact) => l.buyerPaid && !l.cancelled && (l.status === 'HELD' || l.status === 'RELEASED')

export function walletBalances(purchases: PurchaseFact[], lines: SaleLineFact[]): WalletBalances {
  const ps = purchases.filter(inEscrow)
  const ls = lines.filter(receivable)
  return {
    inEscrowCents: ps.reduce((t, p) => t + p.totalCents, 0n),
    inEscrowCount: ps.length,
    receivableCents: ls.reduce((t, l) => t + l.amountCents, 0n),
    receivableCount: new Set(ls.map((l) => l.dealId)).size,
  }
}

export function balanceNotes(b: WalletBalances): { escrow: string; receivable: string } {
  return {
    escrow: b.inEscrowCount === 0 ? 'nenhuma compra em curso' : b.inEscrowCount === 1 ? '1 compra em curso' : `${b.inEscrowCount} compras em curso`,
    receivable: b.receivableCount === 0 ? 'nenhuma venda em curso' : b.receivableCount === 1 ? '1 venda a receber' : `${b.receivableCount} vendas a receber`,
  }
}

export type MovementKind = 'PURCHASE' | 'HOLD_RELEASED' | 'SALE_PAID'
export interface Movement { key: string; kind: MovementKind; icon: string; title: string; sub: string; amount: string; tone: 'out' | 'in' | 'neutral'; at: Date }

const KIND: Record<MovementKind, { icon: string; label: string; tone: Movement['tone'] }> = {
  PURCHASE: { icon: 'shopping_bag', label: 'Compra concluída', tone: 'out' },
  HOLD_RELEASED: { icon: 'undo', label: 'Pré-autorização estornada', tone: 'neutral' },
  SALE_PAID: { icon: 'payments', label: 'Venda paga', tone: 'in' },
}

export function walletMovements(purchases: PurchaseFact[], holds: ReleasedHoldFact[], lines: SaleLineFact[], take = 30): Movement[] {
  const row = (key: string, kind: MovementKind, title: string, code: string, cents: bigint, at: Date): Movement => {
    const k = KIND[kind]
    return { key, kind, icon: k.icon, title, sub: `${k.label} · ${code}`, amount: `${k.tone === 'out' ? '− ' : k.tone === 'in' ? '+ ' : ''}${formatBRL(cents)}`, tone: k.tone, at }
  }
  const out: Movement[] = [
    ...purchases.filter((p) => p.completedAt && !p.cancelled).map((p) => row(`p${p.id}`, 'PURCHASE', p.title, p.code, p.totalCents, p.completedAt!)),
    ...holds.map((h) => row(`h${h.id}`, 'HOLD_RELEASED', h.title, h.code, h.amountCents, h.at)),
    ...lines.filter((l) => l.status === 'PAID' && l.transferredAt).map((l) => row(`s${l.id}`, 'SALE_PAID', l.title, l.dealCode, l.amountCents, l.transferredAt!)),
  ]
  return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take)
}
