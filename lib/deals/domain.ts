// Deal phases — the 6 steps of "Vendas · Em andamento"/"Compras" + COMPLETED. Pure.
export const DEAL_PHASES = ['OFFER_ACCEPTED', 'ESCROW', 'DOCUMENTS', 'SHIPPING', 'DELIVERY', 'TRANSFER', 'COMPLETED'] as const
export type DealPhase = (typeof DEAL_PHASES)[number]

export interface PhaseStep { phase: DealPhase; title: string; icon: string; pending: string }

/** The timeline labels of the design; `pending` is the description before the phase is done. */
export const PHASE_STEPS: readonly PhaseStep[] = [
  { phase: 'OFFER_ACCEPTED', title: 'Oferta aceita', icon: 'handshake', pending: 'Aguardando o pagamento em garantia' },
  { phase: 'ESCROW', title: 'Pagamento em garantia', icon: 'lock', pending: 'Valor a ser retido na HouseArt' },
  { phase: 'DOCUMENTS', title: 'Documentação e assinatura', icon: 'draw', pending: 'Termo de transferência a assinar pelas partes' },
  { phase: 'SHIPPING', title: 'Retirada e transporte', icon: 'local_shipping', pending: 'Transportadora a definir' },
  { phase: 'DELIVERY', title: 'Entrega e leitura da etiqueta', icon: 'contactless', pending: 'Comprador encosta o celular no verso para confirmar' },
  { phase: 'TRANSFER', title: 'Escritura emitida', icon: 'contract', pending: 'Novo titular registrado e valores liberados' },
]

export function phaseIndex(phase: DealPhase): number {
  return DEAL_PHASES.indexOf(phase)
}

/** The step the deal is AT (0..5); COMPLETED = 6 (all done). */
export function progressPct(phase: DealPhase): number {
  return Math.round((phaseIndex(phase) / 6) * 100)
}

export function nextPhase(phase: DealPhase): DealPhase | null {
  const i = phaseIndex(phase)
  return i >= 0 && i < DEAL_PHASES.length - 1 ? DEAL_PHASES[i + 1] : null
}

export function dealCode(year: number, seq: number): string {
  return `DL-${year}-${String(seq).padStart(6, '0')}`
}

export const ESCROW_HOURS = 24

/**
 * Coleção › "Chegando" (handoff "HouseArt Web Colecionador"): what a purchase still on its way says
 * in the buyer's collection, by the LAST phase done. Null when it is not arriving (completed).
 */
export function arrivingLabel(phase: DealPhase, exception: string | null = null): string | null {
  if (phase === 'COMPLETED' || exception === 'CANCELLED') return null
  if (exception) return 'Em análise pela HouseArt'
  switch (phase) {
    case 'OFFER_ACCEPTED': return 'Reservada · aguardando pagamento'
    case 'ESCROW': return 'Chegando · termo a assinar'
    case 'DOCUMENTS': return 'Chegando · aguardando envio'
    case 'SHIPPING': return 'Chegando · em trânsito'
    // DELIVERY only stays when the deed issue failed after the tap (nothing retries it): neutral, as the purchase card
    case 'DELIVERY':
    case 'TRANSFER': return 'Entregue · escritura pendente'
    default: return null
  }
}
