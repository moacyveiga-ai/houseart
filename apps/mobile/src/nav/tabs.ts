// The tab set per profile (brief M0). One binary, three modes; the consultant
// and the staff/appraiser fall into the closest set until they get their own.
import type { ProfileKind } from '@/auth/types'

export type TabKey = 'explore' | 'messages' | 'community' | 'wallet' | 'profile' | 'home' | 'artworks' | 'sales' | 'certification' | 'notifications'

export interface TabDef {
  key: TabKey
  title: string
  /** Material icon name (@expo/vector-icons MaterialIcons). */
  icon: 'explore' | 'chat' | 'forum' | 'account-balance-wallet' | 'person' | 'space-dashboard' | 'image' | 'handshake' | 'verified' | 'notifications'
  /** Web route opened inside the WebView; null = native screen. */
  path: string | null
}

export const TABS: Record<TabKey, TabDef> = {
  explore: { key: 'explore', title: 'Explorar', icon: 'explore', path: '/explore' },
  messages: { key: 'messages', title: 'Mensagens', icon: 'chat', path: '/messages' },
  community: { key: 'community', title: 'Comunidade', icon: 'forum', path: '/community' },
  wallet: { key: 'wallet', title: 'Carteira', icon: 'account-balance-wallet', path: '/wallet' },
  profile: { key: 'profile', title: 'Perfil', icon: 'person', path: null },
  home: { key: 'home', title: 'Início', icon: 'space-dashboard', path: '/' },
  artworks: { key: 'artworks', title: 'Obras', icon: 'image', path: '/artworks' },
  sales: { key: 'sales', title: 'Vendas', icon: 'handshake', path: '/sales' },
  certification: { key: 'certification', title: 'Certificação', icon: 'verified', path: '/certification' },
  notifications: { key: 'notifications', title: 'Avisos', icon: 'notifications', path: '/notifications' },
}

const COLLECTOR: TabKey[] = ['explore', 'messages', 'community', 'wallet', 'profile']
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
  return TABS[key].title
}
