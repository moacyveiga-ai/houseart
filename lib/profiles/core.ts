// Product profiles (the switcher in the panel topbar). Pure.
import type { ProfileKind } from './nav'

export const PROFILE_KINDS = ['ARTIST', 'GALLERY', 'ADVISOR', 'COLLECTOR', 'APPRAISER', 'STAFF'] as const
export type ProfileKindKey = (typeof PROFILE_KINDS)[number]

export interface ProfileCard { kind: ProfileKindKey; name: string; icon: string; description: string }

/** The six cards of the design, in its order. */
export const PROFILE_CARDS: readonly ProfileCard[] = [
  { kind: 'ARTIST', name: 'Artista', icon: 'palette', description: 'Cadastre e certifique suas obras, venda e receba o direito de sequência.' },
  { kind: 'GALLERY', name: 'Galeria', icon: 'storefront', description: 'Inventário, artistas representados, consignações, viewing rooms e CRM.' },
  { kind: 'COLLECTOR', name: 'Colecionador', icon: 'account_balance_wallet', description: 'Sua carteira de escrituras: compre, transfira, segure e avalie.' },
  { kind: 'APPRAISER', name: 'Prestador de serviço · avaliador', icon: 'query_stats', description: 'Fila de laudos, dossiê da obra e emissão do laudo assinado.' },
  { kind: 'ADVISOR', name: 'Consultor de arte', icon: 'support_agent', description: 'Clientes, propostas em nome deles e parcerias com galerias.' },
  { kind: 'STAFF', name: 'Equipe HouseArt', icon: 'admin_panel_settings', description: 'Revisão de certificados, etiquetas, transações e compliance.' },
]

/** UserProfile.kind → the NAV key of lib/profiles/nav.ts. */
export function navProfileOf(kind: string): ProfileKind {
  switch (kind) {
    case 'ARTIST': return 'artist'
    case 'GALLERY': return 'gallery'
    case 'ADVISOR': return 'advisor'
    case 'COLLECTOR': return 'collector'
    case 'APPRAISER': return 'appraiser'
    case 'STAFF': return 'admin'
    default: return 'artist'
  }
}

/**
 * The profile a session opens in when it has not picked one: the account's
 * default (UserProfile.isDefault) when it is still available, else the first
 * card in the design's order. null only for an account with no profile.
 */
export function defaultProfileKind(cards: readonly ProfileCard[], defaultKind: string | null): ProfileKindKey | null {
  if (defaultKind && cards.some((c) => c.kind === defaultKind)) return defaultKind as ProfileKindKey
  return cards[0]?.kind ?? null
}

/** Which cards a user may pick: own profiles only; STAFF and APPRAISER are granted by the house. */
export function availableCards(ownKinds: readonly string[]): ProfileCard[] {
  return PROFILE_CARDS.filter((c) => ownKinds.includes(c.kind))
}

/** The Member.kind that a self-signup profile creates (null = no Member: collector). */
export function memberKindOf(kind: ProfileKindKey): 'ARTIST' | 'GALLERY_STAFF' | 'ADVISOR' | null {
  if (kind === 'ARTIST') return 'ARTIST'
  if (kind === 'GALLERY') return 'GALLERY_STAFF'
  if (kind === 'ADVISOR') return 'ADVISOR'
  return null
}

/** The login profile (User.profile) that a product profile implies. */
export function loginProfileOf(kind: ProfileKindKey): 'member' | 'collector' | 'appraiser' | 'operator' {
  if (kind === 'COLLECTOR') return 'collector'
  if (kind === 'APPRAISER') return 'appraiser'
  if (kind === 'STAFF') return 'operator'
  return 'member'
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase()
}

const SWAP_NAMES: Partial<Record<ProfileKindKey, string>> = { COLLECTOR: 'colecionador', GALLERY: 'galeria', ADVISOR: 'consultor', ARTIST: 'artista' }

/**
 * The topbar shortcut of the design ("Ver como colecionador" on the gallery's panel, "Ver como
 * galeria" on the collector's): the counterpart profile the person also has. Selling profiles
 * point to the collector; the collector points to the first selling profile it has (gallery,
 * advisor, artist). Null when there is no counterpart — the switcher menu still lists them all.
 */
export function swapTarget(profiles: readonly { kind: ProfileKindKey; active: boolean }[]): { kind: ProfileKindKey; label: string } | null {
  const active = profiles.find((p) => p.active)?.kind
  const has = (k: ProfileKindKey) => profiles.some((p) => p.kind === k && !p.active)
  if (!active) return null
  const target: ProfileKindKey | undefined = active === 'COLLECTOR'
    ? (['GALLERY', 'ADVISOR', 'ARTIST'] as const).find(has)
    : active === 'GALLERY' || active === 'ADVISOR' || active === 'ARTIST' ? (has('COLLECTOR') ? 'COLLECTOR' : undefined) : undefined
  return target ? { kind: target, label: `Ver como ${SWAP_NAMES[target]}` } : null
}
