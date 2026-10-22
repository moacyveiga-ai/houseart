// Navigation per profile — ported literally from `NAV` in
// houseart-design/app-source.tsx (the Claude Design source of truth), plus the
// handoff Phase 4 entries ("Carteira e cartões", "Pix para receber") and the
// Phase 5 ones ("Mensagens", "Comunidade" for artist, gallery, collector and
// advisor — the App Artista prototype has no community yet; handoff §6 Fase 8
// says to reuse the Colecionador/Galeria screens). The
// consultant uses the gallery screens (B.1); the badge count comes from the
// server at render time, never from here.
export type ProfileKind = 'artist' | 'gallery' | 'collector' | 'appraiser' | 'advisor' | 'admin'

export interface NavItem {
  key: string
  label: string
  icon: string
  href: string
}

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  artist: 'Artista',
  gallery: 'Galeria',
  collector: 'Colecionador',
  appraiser: 'Prestador · avaliador',
  advisor: 'Consultor de arte',
  admin: 'Admin HouseArt',
}

const ARTIST: NavItem[] = [
  { key: 'home', label: 'Início', icon: 'space_dashboard', href: '/' },
  { key: 'artworks', label: 'Minhas obras', icon: 'imagesmode', href: '/artworks' },
  { key: 'new', label: 'Nova obra', icon: 'add_photo_alternate', href: '/artworks/new' },
  { key: 'certification', label: 'Certificação', icon: 'verified', href: '/certification' },
  { key: 'sales', label: 'Vendas e ofertas', icon: 'handshake', href: '/sales' },
  { key: 'payout', label: 'Pix para receber', icon: 'account_balance', href: '/sales/payout' },
  { key: 'messages', label: 'Mensagens', icon: 'chat', href: '/messages' },
  { key: 'community', label: 'Comunidade', icon: 'forum', href: '/community' },
  { key: 'royalty', label: 'Direito de sequência', icon: 'autorenew', href: '/royalty' },
  { key: 'billing', label: 'Cobrança', icon: 'receipt_long', href: '/billing' },
]

const GALLERY: NavItem[] = [
  { key: 'home', label: 'Início', icon: 'space_dashboard', href: '/' },
  { key: 'artworks', label: 'Inventário', icon: 'inventory_2', href: '/artworks' },
  { key: 'new', label: 'Nova obra', icon: 'add_photo_alternate', href: '/artworks/new' },
  { key: 'certification', label: 'Certificação', icon: 'verified', href: '/certification' },
  { key: 'sales', label: 'Vendas e ofertas', icon: 'handshake', href: '/sales' },
  { key: 'payout', label: 'Pix para receber', icon: 'account_balance', href: '/sales/payout' },
  { key: 'crm', label: 'Colecionadores', icon: 'view_kanban', href: '/crm' },
  { key: 'messages', label: 'Mensagens', icon: 'chat', href: '/messages' },
  { key: 'community', label: 'Comunidade', icon: 'forum', href: '/community' },
  { key: 'royalty', label: 'Direito de sequência', icon: 'autorenew', href: '/royalty' },
  { key: 'billing', label: 'Cobrança', icon: 'receipt_long', href: '/billing' },
  { key: 'team', label: 'Equipe', icon: 'groups', href: '/gallery/team' },
  { key: 'artists', label: 'Artistas', icon: 'palette', href: '/gallery/artists' },
  { key: 'account', label: 'Conta da galeria', icon: 'settings', href: '/gallery/account' },
]

// Handoff "Web Colecionador": Explorar (feed · descobrir) opens the profile,
// Favoritos e curtidos and Perfil · minha conta close it.
const COLLECTOR: NavItem[] = [
  { key: 'explore', label: 'Explorar', icon: 'explore', href: '/explore' },
  { key: 'wallet', label: 'Carteira de escrituras', icon: 'account_balance_wallet', href: '/wallet' },
  { key: 'cards', label: 'Carteira e cartões', icon: 'credit_card', href: '/wallet/cards' },
  { key: 'purchases', label: 'Compras', icon: 'local_shipping', href: '/purchases' },
  { key: 'transfer', label: 'Transferir obra', icon: 'swap_horiz', href: '/transfer' },
  { key: 'marketplace', label: 'Marketplace', icon: 'storefront', href: '/marketplace' },
  { key: 'messages', label: 'Mensagens', icon: 'chat', href: '/messages' },
  { key: 'community', label: 'Comunidade', icon: 'forum', href: '/community' },
  { key: 'favorites', label: 'Favoritos', icon: 'favorite', href: '/favorites' },
  { key: 'account', label: 'Minha conta', icon: 'person', href: '/account' },
]

const APPRAISER: NavItem[] = [
  { key: 'appraisals', label: 'Fila de laudos', icon: 'assignment', href: '/appraisals' },
]

const ADMIN: NavItem[] = [
  { key: 'review', label: 'Obras e certificados', icon: 'fact_check', href: '/admin/review' },
  { key: 'markers', label: 'Etiquetas', icon: 'sell', href: '/admin/markers' },
  { key: 'billing', label: 'Cobrança', icon: 'receipt_long', href: '/billing' },
]

export const NAV: Record<ProfileKind, readonly NavItem[]> = {
  artist: ARTIST,
  gallery: GALLERY,
  collector: COLLECTOR,
  appraiser: APPRAISER,
  advisor: GALLERY,
  admin: ADMIN,
}

/** First screen of each profile (what "Escolha de perfil" opens). */
export function homeOf(profile: ProfileKind): string {
  return NAV[profile][0].href
}

/** The nav item that is "on" for a pathname: the longest href prefix wins. */
export function activeNavKey(profile: ProfileKind, pathname: string): string | null {
  let best: NavItem | null = null
  for (const item of NAV[profile]) {
    const hit = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/')
    if (hit && (!best || item.href.length > best.href.length)) best = item
  }
  return best?.key ?? null
}
