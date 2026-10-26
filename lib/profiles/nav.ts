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
  /** other path prefixes that light this item (the screens that live "inside" it) */
  also?: readonly string[]
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

// Handoff "Web Galeria" (out.tabs): five entries — Acervo · Negócios · Comunidade ·
// Mensagens · Galeria. "Galeria" is the painel do dia and the account; team,
// artists, payout, billing, certification, collectors and royalty live inside it
// (audit 2026-10-25: the old 14-item menu of the Web App).
const GALLERY: NavItem[] = [
  { key: 'artworks', label: 'Acervo', icon: 'imagesmode', href: '/artworks' },
  { key: 'sales', label: 'Negócios', icon: 'handshake', href: '/sales' },
  { key: 'community', label: 'Comunidade', icon: 'forum', href: '/community' },
  { key: 'messages', label: 'Mensagens', icon: 'chat_bubble', href: '/messages' },
  { key: 'home', label: 'Galeria', icon: 'storefront', href: '/', also: ['/gallery', '/billing', '/certification', '/crm', '/royalty', '/wallet/cards', '/sales/payout'] },
]

// Handoff "Web Colecionador": Explorar (feed · descobrir) opens the profile,
// Favoritos e curtidos and Perfil · minha conta close it. "Vendas" (App
// Colecionador › Vendas · oferta recebida) came with the collector as seller
// (decision of 2026-10-22) and sits right after Compras.
const COLLECTOR: NavItem[] = [
  { key: 'explore', label: 'Explorar', icon: 'explore', href: '/explore' },
  { key: 'wallet', label: 'Carteira de escrituras', icon: 'account_balance_wallet', href: '/wallet' },
  { key: 'cards', label: 'Carteira e cartões', icon: 'credit_card', href: '/wallet/cards' },
  { key: 'purchases', label: 'Compras', icon: 'local_shipping', href: '/purchases' },
  { key: 'sales', label: 'Vendas', icon: 'handshake', href: '/sales' },
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
  // Not in the design: the editors of the public site (news and agenda), 2026-10-22.
  { key: 'content', label: 'Conteúdo do site', icon: 'newspaper', href: '/admin/content' },
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

/** "Minha conta" of each profile: the gallery desk has its own account screen. */
export function accountHrefOf(profile: ProfileKind): string {
  return profile === 'gallery' || profile === 'advisor' ? '/gallery/account' : '/account'
}

/** "Ajuda" of the sidebar footer: the public "Como funciona" until a help center exists. */
export const HELP_HREF = '/e/how-it-works'

/** First screen of each profile (where the profile switcher lands): the gallery desk opens on its painel do dia. */
export function homeOf(profile: ProfileKind): string {
  return profile === 'gallery' || profile === 'advisor' ? '/' : NAV[profile][0].href
}

/** The nav item that is "on" for a pathname: the longest href prefix wins. */
export function activeNavKey(profile: ProfileKind, pathname: string): string | null {
  let best: { key: string; len: number } | null = null
  for (const item of NAV[profile]) {
    for (const p of [item.href, ...(item.also ?? [])]) {
      const hit = p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
      if (hit && (!best || p.length > best.len)) best = { key: item.key, len: p.length }
    }
  }
  return best?.key ?? null
}
