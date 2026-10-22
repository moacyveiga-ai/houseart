// The tab set per profile (brief M0). One binary, three modes; the consultant
// and the staff/appraiser fall into the closest set until they get their own.
import type { ProfileKind } from '@/auth/types'

export type TabKey = 'explore' | 'messages' | 'community' | 'wallet' | 'profile' | 'home' | 'artworks' | 'sales' | 'certification' | 'notifications'

export type TabIcon = 'explore' | 'chat' | 'forum' | 'account-balance-wallet' | 'collections' | 'person' | 'space-dashboard' | 'image' | 'handshake' | 'verified' | 'notifications'

export interface TabDef {
  key: TabKey
  title: string
  /** Material icon name (@expo/vector-icons MaterialIcons). */
  icon: TabIcon
  /** Web route opened inside the WebView; null = native screen (App Colecionador fases 1 e 2: Explorar, Coleção, Mensagens, Comunidade). */
  path: string | null
}

export const TABS: Record<TabKey, TabDef> = {
  explore: { key: 'explore', title: 'Explorar', icon: 'explore', path: null },
  messages: { key: 'messages', title: 'Mensagens', icon: 'chat', path: null },
  community: { key: 'community', title: 'Comunidade', icon: 'forum', path: null },
  // Native "Minha coleção" for the collector; the web "Carteira" for the other profiles (see app/(tabs)/wallet.tsx).
  wallet: { key: 'wallet', title: 'Carteira', icon: 'account-balance-wallet', path: null },
  profile: { key: 'profile', title: 'Perfil', icon: 'person', path: null },
  home: { key: 'home', title: 'Início', icon: 'space-dashboard', path: '/' },
  artworks: { key: 'artworks', title: 'Obras', icon: 'image', path: '/artworks' },
  sales: { key: 'sales', title: 'Vendas', icon: 'handshake', path: '/sales' },
  certification: { key: 'certification', title: 'Certificação', icon: 'verified', path: '/certification' },
  notifications: { key: 'notifications', title: 'Avisos', icon: 'notifications', path: '/notifications' },
}

// The order of the prototype's bottom bar: Explorar · Coleção · Comunidade · Mensagens · Perfil.
const COLLECTOR: TabKey[] = ['explore', 'wallet', 'community', 'messages', 'profile']
const GALLERY: TabKey[] = ['home', 'artworks', 'sales', 'messages', 'community']
const ARTIST: TabKey[] = ['home', 'artworks', 'certification', 'messages', 'notifications']

export function tabsFor(kind: ProfileKind | null): TabKey[] {
  switch (kind) {
    case 'COLLECTOR': return COLLECTOR
    case 'GALLERY':
    case 'ADVISOR': return GALLERY
    case 'ARTIST': return ARTIST
    // STAFF/APPRAISER have no mobile design yet: the gallery set shows their web panel.
    case 'APPRAISER':
    case 'STAFF': return GALLERY
    default: return COLLECTOR
  }
}

/** The web route that `Obras` means for this profile (`/artworks` is the same path for both). */
export function labelFor(kind: ProfileKind | null, key: TabKey): string {
  if (key === 'artworks' && (kind === 'GALLERY' || kind === 'ADVISOR')) return 'Acervo'
  if (key === 'wallet' && isCollector(kind)) return 'Coleção'
  return TABS[key].title
}

export function iconFor(kind: ProfileKind | null, key: TabKey): TabIcon {
  if (key === 'wallet' && isCollector(kind)) return 'collections'
  return TABS[key].icon
}

/** The collector set is also the default (no profile chosen yet). */
export const isCollector = (kind: ProfileKind | null): boolean => kind === 'COLLECTOR' || kind === null
