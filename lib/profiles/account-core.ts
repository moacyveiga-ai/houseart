// "Minha conta" (/account) by navigation profile — PURE. The page was written for the collector
// (Coleção, Cadastrar obra pela carteira, Compras, Pix) and every other profile's "Configurações"
// landed there too: an artist met "Cadastrar obra" → /wallet/register (403 for an artist member).
// Here each profile gets its own work section and only the blocks that exist for it.
import type { ProfileKind } from './nav'

export interface AccountLink { icon: string; name: string; sub: string; href: string }
export interface AccountShape {
  /** the profile's own section (title + links), right after Cadastro */
  work: { name: string; items: AccountLink[] } | null
  /** Carteira e cartões, Notas e comprovantes */
  payments: boolean
  /** Pix para receber vendas (only who sells in their own name) */
  payout: boolean
  /** Instagram (post to their own account) */
  social: boolean
  /** Endereços de entrega (who buys) */
  addresses: boolean
}

const COLLECTOR_WORK: AccountLink[] = [
  { icon: 'collections', name: 'Minha coleção', sub: 'As obras e escrituras no seu nome', href: '/wallet' },
  { icon: 'add_photo_alternate', name: 'Cadastrar obra', sub: 'Uma obra que já é sua, para certificar e vender', href: '/wallet/register' },
  { icon: 'favorite', name: 'Favoritos e curtidos', sub: '', href: '/favorites' },
  { icon: 'local_shipping', name: 'Compras', sub: 'Ofertas, pagamentos e entregas', href: '/purchases' },
  { icon: 'swap_horiz', name: 'Transferir uma obra', sub: 'Venda feita fora da HouseArt, registrada na escritura', href: '/transfer' },
]

const ARTIST_WORK: AccountLink[] = [
  { icon: 'imagesmode', name: 'Minhas obras', sub: 'Cadastro, certificação e anúncio', href: '/artworks' },
  { icon: 'add_photo_alternate', name: 'Nova obra', sub: 'Fotos guiadas, ficha e envio para certificar', href: '/artworks/new' },
  { icon: 'verified', name: 'Certificação', sub: 'Etiquetas e certificados a assinar', href: '/certification' },
  { icon: 'handshake', name: 'Vendas e ofertas', sub: 'Propostas recebidas e vendas até o repasse', href: '/sales' },
  { icon: 'badge', name: 'Perfil público', sub: 'Biografia, exposições e foto da sua página', href: '/profile/public' },
  { icon: 'local_shipping', name: 'Compras', sub: 'Obras que você comprou', href: '/purchases' },
]

const APPRAISER_WORK: AccountLink[] = [
  { icon: 'assignment', name: 'Fila de laudos', sub: 'Pedidos atribuídos e a assumir', href: '/appraisals' },
]

const ADMIN_WORK: AccountLink[] = [
  { icon: 'fact_check', name: 'Obras e certificados', sub: 'Fila de revisão da equipe', href: '/admin/review' },
  { icon: 'manage_accounts', name: 'Usuários e contas', sub: 'Bloquear, redefinir senha, papéis', href: '/admin/users' },
  { icon: 'monitor_heart', name: 'Saúde', sub: 'Rotinas, webhooks e alertas do financeiro', href: '/admin/ops' },
]

export function accountShapeOf(profile: ProfileKind): AccountShape {
  switch (profile) {
    case 'collector': return { work: { name: 'Coleção', items: COLLECTOR_WORK }, payments: true, payout: true, social: true, addresses: true }
    case 'artist': return { work: { name: 'Ateliê', items: ARTIST_WORK }, payments: true, payout: true, social: true, addresses: true }
    case 'appraiser': return { work: { name: 'Laudos', items: APPRAISER_WORK }, payments: false, payout: false, social: false, addresses: false }
    case 'admin': return { work: { name: 'Equipe HouseArt', items: ADMIN_WORK }, payments: false, payout: false, social: false, addresses: false }
    // gallery and advisor have their own account screen (/gallery/account); /account reached by URL shows the person
    default: return { work: null, payments: true, payout: false, social: false, addresses: true }
  }
}
