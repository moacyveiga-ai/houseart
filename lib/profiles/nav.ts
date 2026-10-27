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

// Handoff "Web Colecionador" (out.tabs): Explorar · Coleção · Comunidade · Mensagens ·
// Perfil. "Coleção" is "Minha coleção" with the tabs Obras · Favoritos · Curtidos ·
// Compras · Vendas; payments, Pix and transfer live in the Perfil and the
// collection (audit 2026-10-25: the old 11-item menu).
const COLLECTOR: NavItem[] = [
  { key: 'explore', label: 'Explorar', icon: 'explore', href: '/explore', also: ['/marketplace', '/search'] },
  { key: 'wallet', label: 'Coleção', icon: 'collections', href: '/wallet', also: ['/favorites', '/purchases', '/sales', '/transfer'] },
  { key: 'community', label: 'Comunidade', icon: 'forum', href: '/community' },
  { key: 'messages', label: 'Mensagens', icon: 'chat_bubble', href: '/messages' },
  { key: 'account', label: 'Perfil', icon: 'person', href: '/account', also: ['/wallet/cards', '/sales/payout', '/notifications'] },
]

// The autonomous art advisor uses the gallery desk, but has no gallery: the fifth entry is the
// painel do dia under its own name (audit galeria §0).
const ADVISOR: NavItem[] = GALLERY.map((i) => (i.key === 'home' ? { ...i, label: 'Início', icon: 'space_dashboard' } : i))

const APPRAISER: NavItem[] = [
  { key: 'appraisals', label: 'Fila de laudos', icon: 'assignment', href: '/appraisals' },
]

const ADMIN: NavItem[] = [
  { key: 'review', label: 'Obras e certificados', icon: 'fact_check', href: '/admin/review' },
  { key: 'markers', label: 'Etiquetas', icon: 'sell', href: '/admin/markers' },
  // Not in the design: the desk's view of every deal (audit 2026-10-25, web-app §admin), 2026-10-26.
  { key: 'deals', label: 'Negócios', icon: 'handshake', href: '/admin/deals' },
  { key: 'users', label: 'Usuários e contas', icon: 'manage_accounts', href: '/admin/users' },
  // Not in the design: the galleries and autonomous accounts (plan, team, contracts, suspension), audit §5, 2026-10-26.
  { key: 'tenants', label: 'Galerias e contas', icon: 'storefront', href: '/admin/tenants' },
  { key: 'kyc', label: 'KYC', icon: 'verified_user', href: '/admin/kyc' },
  // Not in the design: the off-platform transfers and what each waits for (audit §5), 2026-10-26.
  { key: 'transfers', label: 'Transferências', icon: 'swap_horiz', href: '/admin/transfers' },
  { key: 'audit', label: 'Auditoria', icon: 'history', href: '/admin/audit' },
  // Not in the design: crons, webhooks and configuration at a glance (audit §5), 2026-10-26.
  { key: 'ops', label: 'Saúde', icon: 'monitor_heart', href: '/admin/ops' },
  // Not in the design: the appraisal queue the team assigns and follows (audit §5), 2026-10-26.
  { key: 'appraisals', label: 'Laudos', icon: 'assignment', href: '/appraisals' },
  // Not in the design: the editors of the public site (news and agenda), 2026-10-22.
  { key: 'content', label: 'Conteúdo do site', icon: 'newspaper', href: '/admin/content' },
  // Not in the design: plans, services and the marker price, editable without SQL (audit §5), 2026-10-26.
  { key: 'catalog', label: 'Catálogo', icon: 'sell', href: '/admin/catalog' },
  { key: 'billing', label: 'Cobrança', icon: 'receipt_long', href: '/billing' },
]

export const NAV: Record<ProfileKind, readonly NavItem[]> = {
  artist: ARTIST,
  gallery: GALLERY,
  collector: COLLECTOR,
  appraiser: APPRAISER,
  advisor: ADVISOR,
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
