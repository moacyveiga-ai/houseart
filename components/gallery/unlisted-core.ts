// "Gestão do anúncio" of an artwork that is not for sale (audit galeria §3): instead of a dead-end
// callout, say where the artwork is and offer the next step — the prototype's "Vender esta obra" /
// "Peça certificação" / "Em certificação" / "Reservada · em negociação".

export type UnlistedAction =
  | { kind: 'link'; label: string; href: string; icon: string }
  | { kind: 'sell' }
  | null

export interface UnlistedState { icon: string; title: string; sub: string; action: UnlistedAction }

/** `canManage` = may price and list (Vendas and Admin); `canEdit` = may touch the record (also Acervo). */
export function unlistedState(a: { id: number; status: string; seal: string; publicId: string | null }, can: { manage: boolean; edit: boolean }): UnlistedState {
  const edit = can.edit ? { kind: 'link' as const, label: 'Abrir o cadastro', href: `/artworks/${a.id}/edit`, icon: 'edit' } : null
  switch (a.status) {
    case 'DRAFT':
      return { icon: 'edit_note', title: 'Peça a certificação', sub: 'A obra é rascunho: complete o cadastro e envie para a certificação para poder vendê-la.', action: can.edit ? { ...edit!, label: 'Completar e enviar' } : null }
    case 'IN_CERTIFICATION':
      return a.publicId
        ? { icon: 'draw', title: 'Em certificação', sub: 'A etiqueta está vinculada: falta assinar e emitir o certificado.', action: can.edit ? { kind: 'link', label: 'Assinar o certificado', href: '/certification', icon: 'draw' } : null }
        : { icon: 'contactless', title: 'Em certificação', sub: 'Vincule a etiqueta do verso para emitir o certificado.', action: can.edit ? { kind: 'link', label: 'Vincular etiqueta', href: `/certification/link/${a.id}`, icon: 'contactless' } : null }
    case 'AUTHENTICATED':
      if (a.seal !== 'GREEN') return { icon: 'pending', title: 'Selo em análise', sub: 'A obra só vai ao marketplace com o selo "Obra Autenticada" verde.', action: null }
      return { icon: 'sell', title: 'Vender esta obra', sub: can.manage ? 'Defina o preço e o piso — o piso só você vê.' : 'Quem tem o papel de Vendas ou Admin publica a obra no marketplace.', action: can.manage ? { kind: 'sell' } : null }
    case 'IN_DEAL':
      return { icon: 'handshake', title: 'Reservada · em negociação', sub: 'Há um negócio em andamento para esta obra.', action: { kind: 'link', label: 'Acompanhar a venda', href: '/sales?tab=deals', icon: 'local_shipping' } }
    case 'SOLD':
      return { icon: 'task_alt', title: 'Vendida', sub: 'A escritura foi transferida ao comprador.', action: null }
    case 'STOLEN':
    case 'DISPUTED':
      return { icon: 'report', title: a.status === 'STOLEN' ? 'Registrada como roubada' : 'Em disputa', sub: 'A obra não pode ser vendida enquanto o caso estiver aberto.', action: null }
    default:
      return { icon: 'inventory_2', title: 'Fora do marketplace', sub: 'A obra não está à venda.', action: edit }
  }
}
