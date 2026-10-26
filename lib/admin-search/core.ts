// Admin › Busca com escopo total — pure rules: what the term looks like (an `HA-…` certificate, a
// `DL-…` deal, a `#id`, an e-mail, free text) and the rows the desk reads. The audit item
// (docs/audit-ux-2026-10-25/web-app.md, correção 11) asked the desk to find artworks in any state,
// certificates, deals and accounts, which the public search never shows.
export const ADMIN_SEARCH_TAKE = 10

export type TermKind = 'certificate' | 'deal' | 'id' | 'email' | 'text'
export function termKindOf(q: string): TermKind {
  const s = q.replace(/\s/g, '')
  if (/^ha-?\d{4}-?[0-9a-z]{4}-?[0-9a-z]{4}$/i.test(s)) return 'certificate'
  if (/^dl-?\d{4}-?\d{1,8}$/i.test(s)) return 'deal'
  if (/^#\d{1,9}$/.test(s)) return 'id'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email'
  return 'text'
}
export const idOf = (q: string): number | null => { const m = /^#(\d{1,9})$/.exec(q.replace(/\s/g, '')); return m ? Number(m[1]) : null }
/** `HA-2026-ABCD-EF12` in canonical form (upper case, dashes) — or null when it is not one. */
export function canonicalPublicId(q: string): string | null {
  const m = /^ha-?(\d{4})-?([0-9a-z]{4})-?([0-9a-z]{4})$/i.exec(q.replace(/\s/g, ''))
  return m ? `HA-${m[1]}-${m[2].toUpperCase()}-${m[3].toUpperCase()}` : null
}
export function canonicalDealCode(q: string): string | null {
  const m = /^dl-?(\d{4})-?(\d{1,8})$/i.exec(q.replace(/\s/g, ''))
  return m ? `DL-${m[1]}-${m[2].padStart(6, '0')}` : null
}

export interface AdminArtworkHit { id: number; title: string; artist: string; owner: string; status: string; statusLabel: string; publicId: string | null; certificateStatus: string | null; cover: string | null; href: string; verifyHref: string | null }
export interface AdminDealHit { id: number; code: string; phase: string; phaseLabel: string; exception: string | null; artworkTitle: string; seller: string; buyer: string; href: string }
export interface AdminUserHit { id: number; name: string; email: string; profile: string; profileLabel: string; active: boolean; member: string | null; href: string }
export interface AdminSearchResult { q: string; artworks: AdminArtworkHit[]; deals: AdminDealHit[]; users: AdminUserHit[]; total: number }

export const EMPTY: AdminSearchResult = { q: '', artworks: [], deals: [], users: [], total: 0 }
