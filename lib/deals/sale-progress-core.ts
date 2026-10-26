// "Vendas até o repasse" (handoff "HouseArt Web Galeria" › Negócios › Vendas): the seller's view
// of a deal in six steps, with the action the seller owes now. PURE.
//
// The design's six steps (VE) are Pago em garantia · Embalar e condition report · Agendar coleta ·
// Em trânsito · Entregue · Repasse liberado. The platform does not record packaging photos nor a
// pickup booking: the seller signs the cession and registers the carrier + tracking. So steps 2–3 of
// the design become "Termo assinado" and "Envio com seguro" — the facts the deal really holds.
import type { DealPhase } from './domain'

export interface SaleStage { title: string; sub: string; icon: string }

export const SALE_STAGES: readonly SaleStage[] = [
  { title: 'Pago em garantia', sub: 'Comprador pagou · valor retido pela HouseArt', icon: 'lock' },
  { title: 'Termo assinado', sub: 'Vendedor e comprador assinam a cessão da obra', icon: 'draw' },
  { title: 'Envio com seguro', sub: 'Registre a transportadora, o rastreio e o seguro de trânsito', icon: 'inventory_2' },
  { title: 'Em trânsito', sub: 'Obra a caminho do comprador', icon: 'local_shipping' },
  { title: 'Entregue', sub: 'Aguardando o toque do comprador na etiqueta', icon: 'contactless' },
  { title: 'Repasse liberado', sub: 'Escritura transferida e valores liberados', icon: 'payments' },
]

/** The step the sale has REACHED: -1 = waiting for the escrow payment; 5 = completed. */
export function saleStage(phase: DealPhase): number {
  switch (phase) {
    case 'OFFER_ACCEPTED': return -1
    case 'ESCROW': return 0
    case 'DOCUMENTS': return 1
    case 'SHIPPING': return 3 // registering the shipment hands the work to the carrier
    case 'DELIVERY': case 'TRANSFER': return 4
    case 'COMPLETED': return 5
  }
}

export type SaleActionKind = 'sign' | 'ship' | null
export interface SaleAction { label: string; tone: 'pending' | 'wait' | 'done' | 'off'; kind: SaleActionKind }

/** The pill of the row and the main button of the detail: what the SELLER does now. */
export function saleAction(d: { phase: DealPhase; sellerSigned: boolean; exception: string | null }): SaleAction {
  if (d.exception === 'CANCELLED') return { label: 'Cancelada', tone: 'off', kind: null }
  if (d.exception === 'DISPUTE') return { label: 'Em disputa', tone: 'off', kind: null }
  switch (d.phase) {
    case 'OFFER_ACCEPTED': return { label: 'Aguardando pagamento', tone: 'wait', kind: null }
    case 'ESCROW': return d.sellerSigned ? { label: 'Aguardando comprador', tone: 'wait', kind: null } : { label: 'Assinar termo', tone: 'pending', kind: 'sign' }
    case 'DOCUMENTS': return { label: 'Registrar envio', tone: 'pending', kind: 'ship' }
    case 'SHIPPING': return { label: 'Acompanhar', tone: 'wait', kind: null }
    case 'DELIVERY': case 'TRANSFER': return { label: 'Emitindo escritura', tone: 'wait', kind: null }
    case 'COMPLETED': return { label: 'Concluída', tone: 'done', kind: null }
  }
}

/** Title of the step the sale is AT (the row's line and the detail's heading). */
export function saleStageTitle(phase: DealPhase, exception: string | null): string {
  if (exception === 'CANCELLED') return 'Venda cancelada'
  if (exception === 'DISPUTE') return 'Venda em disputa'
  const s = saleStage(phase)
  return s < 0 ? 'Aguardando o pagamento em garantia' : SALE_STAGES[s]!.title
}

/** The six segments of the row: filled up to the stage reached; all green once completed. */
export function saleSegments(phase: DealPhase): ('on' | 'done' | 'off')[] {
  const s = saleStage(phase)
  return SALE_STAGES.map((_, i) => (s === 5 ? 'done' : i <= s ? 'on' : 'off'))
}

/** The vertical steps of the detail: done (green check), current (sand), todo (outlined). */
export function saleSteps(phase: DealPhase): { stage: SaleStage; state: 'done' | 'on' | 'todo' }[] {
  const s = saleStage(phase)
  return SALE_STAGES.map((stage, i) => ({ stage, state: s === 5 || i < s ? 'done' : i === s ? 'on' : 'todo' }))
}

export interface FinanceLine { label: string; cents: bigint; sign: '' | '−'; strong: boolean }

/**
 * The "Financeiro" of the detail from the deal's split lines (what the platform really holds):
 * Valor da venda, the deductions, and what the seller receives. A gallery sale shows the artist's
 * part as a deduction and "Galeria recebe"; an artist or collector sees "Você recebe".
 * SHIPPING / INSURANCE are paid by the buyer on top and are not part of the sale.
 */
export function saleFinance(d: { amountCents: bigint; market: string; sellerKind: string; artistName: string; split: { party: string; amountCents: bigint; bps?: number }[] }): FinanceLine[] {
  const out: FinanceLine[] = [{ label: 'Valor da venda', cents: d.amountCents, sign: '', strong: true }]
  const pct = (cents: bigint) => (d.amountCents > 0n ? `${Math.round(Number((cents * 1000n) / d.amountCents)) / 10}%`.replace('.', ',') : '')
  const gallerySale = d.sellerKind === 'GALLERY_STAFF' || d.sellerKind === 'GALLERY'
  const platform = d.split.filter((s) => s.party === 'PLATFORM').reduce((a, s) => a + s.amountCents, 0n)
  if (platform > 0n) out.push({ label: `Comissão HouseArt · ${pct(platform)}`, cents: platform, sign: '−', strong: false })
  const royalty = d.split.filter((s) => s.party === 'ARTIST_ROYALTY').reduce((a, s) => a + s.amountCents, 0n)
  if (royalty > 0n) out.push({ label: `Direito de sequência · ${d.artistName}`, cents: royalty, sign: '−', strong: false })
  const artist = d.split.filter((s) => s.party === 'ARTIST').reduce((a, s) => a + s.amountCents, 0n)
  if (d.sellerKind === 'ARTIST') {
    out.push({ label: 'Você recebe', cents: artist, sign: '', strong: true })
  } else {
    // a gallery, an advisor or a collector sells: the GALLERY line is the seller's; an ARTIST line is
    // the consignment share paid to the artist (deducted here)
    const seller = d.split.filter((s) => s.party === 'GALLERY').reduce((a, s) => a + s.amountCents, 0n)
    const net = d.amountCents - platform - royalty
    if (artist > 0n) out.push({ label: `Repasse a ${d.artistName}${net > 0n ? ` · ${Math.round(Number((artist * 100n) / net))}% do líquido` : ''}`, cents: artist, sign: '−', strong: false })
    out.push({ label: gallerySale ? 'Galeria recebe' : 'Você recebe', cents: seller, sign: '', strong: true })
  }
  return out
}
