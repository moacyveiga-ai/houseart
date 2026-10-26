// Menu badges — pure rules (audit 2026-10-25, web-app §6 "Badges no menu"): which NAV key each
// count lands on per navigation profile, and the offer rule shared by the seller desks.
import { OPEN_FOR_SELLER } from '@/lib/offers/domain'
import type { ProfileKind } from '@/lib/profiles/nav'

/** Offers that wait on the seller: open for the desk (received, below the reserve, negotiating) and, when negotiating, the buyer made the last move. The same `open` the Vendas screen counts in "Ofertas recebidas". */
export function offerWaitsOnSeller(o: { status: string; expiresAt: Date | string; lastAuthor: string | null }, now: Date): boolean {
  if (new Date(o.expiresAt) <= now) return false
  if (!(OPEN_FOR_SELLER as readonly string[]).includes(o.status)) return false
  return o.status !== 'NEGOTIATING' || o.lastAuthor === 'BUYER'
}

export interface BadgeCounts {
  certification?: number; sales?: number; wallet?: number; appraisals?: number
  review?: number; kyc?: number; deals?: number; transfers?: number; messages?: number
}

/** Keys the layout passes to the shell: only the ones the profile's NAV has, and only non-zero. */
export function badgesFor(profile: ProfileKind, c: BadgeCounts): Record<string, number> {
  const keys: Record<ProfileKind, (keyof BadgeCounts)[]> = {
    artist: ['certification', 'sales', 'messages'],
    gallery: ['sales', 'messages'],
    advisor: ['sales', 'messages'],
    collector: ['wallet', 'messages'],
    appraiser: ['appraisals'],
    admin: ['review', 'kyc', 'deals', 'transfers', 'appraisals'],
  }
  const out: Record<string, number> = {}
  for (const k of keys[profile]) { const v = c[k]; if (v) out[k] = v }
  return out
}
