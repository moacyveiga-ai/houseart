// Excluir minha conta (handoff "Perfil · minha conta" › Excluir) — PURE: the word to type, what blocks it and
// the consequences the sheet lists. The server (deletion-server.ts) counts the negotiations and applies it.
export const DELETE_WORD = 'EXCLUIR'

export const DELETE_CONSEQUENCES = [
  'Você sai de todos os aparelhos e não consegue mais entrar com este e-mail.',
  'Ofertas, conversas e favoritos deixam de aparecer para você.',
  'As escrituras das suas obras continuam válidas: a titularidade é registro público da obra e não some com a conta.',
  'Notas, pagamentos e registros que a lei obriga a guardar ficam conservados pelo prazo legal.',
] as const

export interface OpenNegotiations { offers: number; deals: number; transfers: number }

/** Why the account cannot be deleted now (null = it can). */
export function deletionBlocker(n: OpenNegotiations): string | null {
  const parts: string[] = []
  if (n.deals) parts.push(`${n.deals} ${n.deals === 1 ? 'negócio em andamento' : 'negócios em andamento'}`)
  if (n.offers) parts.push(`${n.offers} ${n.offers === 1 ? 'oferta aberta' : 'ofertas abertas'}`)
  if (n.transfers) parts.push(`${n.transfers} ${n.transfers === 1 ? 'transferência em andamento' : 'transferências em andamento'}`)
  if (!parts.length) return null
  return `Você tem ${parts.join(' e ')}. Conclua, retire ou cancele antes de excluir a conta.`
}

export const typedOk = (typed: unknown) => typeof typed === 'string' && typed.trim().toUpperCase() === DELETE_WORD
