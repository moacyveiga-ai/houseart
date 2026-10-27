// The deal's receipt ("Baixar comprovante", handoff "HouseArt Web Galeria" › Vendas › concluída):
// what each side reads on the PDF of a completed deal. Pure — the PDF draws these rows as they are.
import { formatBRL } from '@/lib/artworks/domain'
import type { FinanceLine } from './sale-progress-core'

export interface ReceiptInput {
  side: 'SELLER' | 'BUYER'
  code: string
  artworkTitle: string
  artist: string
  sellerName: string
  buyerName: string
  market: string
  completedAt: string | null
  amountCents: bigint
  shippingCents: bigint
  insuranceCents: bigint
  /** the seller's Financeiro (saleFinance); ignored on the buyer's receipt */
  finance: FinanceLine[]
}

export interface ReceiptRow { label: string; value: string; strong: boolean }
export interface Receipt { title: string; head: ReceiptRow[]; money: ReceiptRow[]; note: string }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }) : '—')

/** Only a completed deal has a receipt: before that the values can still change. */
export function hasReceipt(phase: string, exception: string | null): boolean {
  return phase === 'COMPLETED' && !exception
}

export function receiptOf(i: ReceiptInput): Receipt {
  const head: ReceiptRow[] = [
    { label: 'Negócio', value: i.code, strong: false },
    { label: 'Obra', value: i.artworkTitle, strong: false },
    { label: 'Artista', value: i.artist, strong: false },
    { label: i.side === 'SELLER' ? 'Comprador' : 'Vendedor', value: i.side === 'SELLER' ? i.buyerName : i.sellerName, strong: false },
    { label: 'Mercado', value: i.market === 'SECONDARY' ? 'Revenda (secundário)' : 'Primário', strong: false },
    { label: 'Concluído em', value: day(i.completedAt), strong: false },
  ]
  if (i.side === 'BUYER') {
    const total = i.amountCents + i.shippingCents + i.insuranceCents
    return {
      title: 'Comprovante de compra',
      head,
      money: [
        { label: 'Obra', value: formatBRL(i.amountCents), strong: false },
        { label: 'Frete', value: i.shippingCents ? formatBRL(i.shippingCents) : 'Grátis', strong: false },
        { label: 'Seguro de transporte', value: i.insuranceCents ? formatBRL(i.insuranceCents) : '—', strong: false },
        { label: 'Total pago', value: formatBRL(total), strong: true },
      ],
      note: 'Valor pago em garantia na HouseArt e liberado ao vendedor com a leitura da etiqueta na entrega. A escritura da obra está em seu nome. Este comprovante não substitui nota fiscal.',
    }
  }
  return {
    title: 'Comprovante de venda',
    head,
    money: i.finance.map((l) => ({ label: l.label, value: `${l.sign ? `${l.sign} ` : ''}${formatBRL(l.cents)}`, strong: l.strong })),
    note: 'Valores conforme a repartição do negócio na HouseArt. Frete e seguro foram pagos pelo comprador e não fazem parte da venda. Este comprovante não substitui nota fiscal.',
  }
}
