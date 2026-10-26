// Notas e comprovantes (handoff "Perfil · minha conta" › Pagamentos): every payment the person made on the
// platform — purchases paid into the guarantee, service orders and transfer fees — newest first, each with
// where to see it. Read-only; the fiscal note itself is the provider's (pending: Pendências §nota fiscal).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { formatBRL } from '@/lib/artworks/domain'
import { escrowChargedCents } from '@/lib/payment-methods/ledger-core'

export interface ReceiptRow { key: string; kind: 'PURCHASE' | 'ORDER' | 'TRANSFER'; title: string; sub: string; amount: string; at: Date; href: string | null }

const KIND_LABEL: Record<ReceiptRow['kind'], string> = { PURCHASE: 'Compra', ORDER: 'Serviço', TRANSFER: 'Taxa de transferência' }
export const receiptKindLabel = (k: ReceiptRow['kind']) => KIND_LABEL[k]

export async function receiptsOf(userId: number, take = 100): Promise<ReceiptRow[]> {
  return totalScope('account:receipts', async () => {
    const [deals, orders, transfers] = await Promise.all([
      prisma.deal.findMany({ where: { buyerUserId: userId, escrowPaidAt: { not: null }, OR: [{ exceptionStatus: null }, { exceptionStatus: 'DISPUTE' }] }, orderBy: { escrowPaidAt: 'desc' }, take, select: { id: true, code: true, amountCents: true, shippingCents: true, insuranceCents: true, escrowPaymentRef: true, escrowPaidAt: true, escrowMethod: true, offer: { select: { guaranteeRef: true } }, artwork: { select: { title: true } } } }),
      // a transfer fee paid as an order is listed once, as the transfer
      prisma.order.findMany({ where: { userId, status: 'PAID', transferId: null }, orderBy: { paidAt: 'desc' }, take, select: { id: true, code: true, description: true, amountCents: true, paidAt: true, createdAt: true } }),
      prisma.ownershipTransfer.findMany({ where: { fromUserId: userId, feePaidAt: { not: null }, feeCents: { gt: 0 } }, orderBy: { feePaidAt: 'desc' }, take, select: { id: true, feeCents: true, feePaidAt: true, artwork: { select: { title: true } } } }),
    ])
    const rows: ReceiptRow[] = [
      ...deals.map((d) => ({ key: `d${d.id}`, kind: 'PURCHASE' as const, title: d.artwork.title, sub: `${d.code}${d.escrowMethod ? ` · ${d.escrowMethod === 'PIX' ? 'Pix' : d.escrowMethod === 'BOLETO' ? 'Boleto' : 'Cartão'}` : ''}`, amount: formatBRL(escrowChargedCents({ ...d, offerHoldRef: d.offer.guaranteeRef })), at: d.escrowPaidAt!, href: '/purchases' })),
      ...orders.map((o) => ({ key: `o${o.id}`, kind: 'ORDER' as const, title: o.description, sub: o.code, amount: formatBRL(o.amountCents), at: o.paidAt ?? o.createdAt, href: null })),
      ...transfers.map((t) => ({ key: `t${t.id}`, kind: 'TRANSFER' as const, title: t.artwork.title, sub: 'Registro da nova titularidade', amount: formatBRL(t.feeCents), at: t.feePaidAt!, href: null })),
    ]
    return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take)
  })
}
