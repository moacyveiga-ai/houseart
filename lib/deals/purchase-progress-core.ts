// "Acompanhar compra" (handoff "HouseArt Web Colecionador" › Compras): the BUYER's view of a deal in
// five steps — Pagamento em garantia · Embalagem museológica · Em trânsito · Entrega · toque na
// etiqueta · Escritura em seu nome. PURE.
//
// The deal records six phases; the buyer's five steps are read from them: the signatures and the
// seller registering the shipment are the "Embalagem" step (the platform does not record packaging
// photos), and DELIVERY/TRANSFER only persist when the deed issue failed after the tap.
import type { DealPhase } from './domain'

export interface PurchaseStage { title: string; icon: string; todo: string; done: string }

export const PURCHASE_STAGES: readonly PurchaseStage[] = [
  { title: 'Pagamento em garantia', icon: 'lock', todo: 'O valor fica retido pela HouseArt até a entrega', done: 'Valor retido pela HouseArt até a entrega' },
  { title: 'Embalagem museológica', icon: 'inventory_2', todo: 'Termo assinado pelas partes e obra embalada pelo vendedor', done: 'Obra embalada e envio registrado com seguro' },
  { title: 'Em trânsito', icon: 'local_shipping', todo: 'Transportadora especializada, com seguro de trânsito', done: 'Obra entregue no seu endereço' },
  { title: 'Entrega · toque na etiqueta', icon: 'contactless', todo: 'Encoste o celular na etiqueta do verso para confirmar', done: 'Leitura válida da etiqueta' },
  { title: 'Escritura em seu nome', icon: 'contract', todo: 'A escritura passa para o seu nome e o vendedor recebe', done: 'Escritura emitida e valores liberados' },
]

/** How many of the five steps are DONE in a phase (5 = completed). */
export function purchaseDone(phase: DealPhase): number {
  switch (phase) {
    case 'OFFER_ACCEPTED': return 0
    case 'ESCROW': case 'DOCUMENTS': return 1
    case 'SHIPPING': return 2
    case 'DELIVERY': case 'TRANSFER': return 4
    case 'COMPLETED': return 5
  }
}

/** The phase whose event dates each step (the step is done when that phase is reached). */
const DATED_BY: readonly DealPhase[][] = [['ESCROW'], ['SHIPPING'], ['DELIVERY', 'TRANSFER', 'COMPLETED'], ['DELIVERY', 'TRANSFER', 'COMPLETED'], ['TRANSFER', 'COMPLETED']]

export interface PurchaseStep { title: string; icon: string; description: string; date: string | null; state: 'done' | 'on' | 'todo' }

/**
 * The five vertical steps of the buyer's timeline from the deal's phase and its dated phase events
 * (the server's six steps). The shipment line names the carrier and the tracking when registered.
 */
export function purchaseSteps(d: { phase: DealPhase; steps: { phase: DealPhase; date: string | null }[]; shipping: { carrier: string | null; tracking: string | null } | null }): PurchaseStep[] {
  const done = purchaseDone(d.phase)
  const dateOf = (phases: DealPhase[]) => phases.map((p) => d.steps.find((s) => s.phase === p)?.date ?? null).find((x) => x) ?? null
  return PURCHASE_STAGES.map((s, i) => {
    const state: PurchaseStep['state'] = i < done ? 'done' : i === done ? 'on' : 'todo'
    let description = state === 'done' ? s.done : s.todo
    if (i === 2 && d.shipping?.carrier && state !== 'todo') description = `${d.shipping.carrier}${d.shipping.tracking ? ` · rastreio ${d.shipping.tracking}` : ''}`
    return { title: s.title, icon: s.icon, description, date: state === 'done' ? dateOf(DATED_BY[i]!) : null, state }
  })
}

/** The buyer's progress number: the share of the five steps done. */
export function purchasePct(phase: DealPhase): number {
  return Math.round((purchaseDone(phase) / PURCHASE_STAGES.length) * 100)
}
