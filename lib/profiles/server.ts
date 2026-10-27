// Profile switch (the switcher in the panel topbar).
import 'server-only'
import { prisma } from '@/lib/prisma'
/** The slice of the session this module reads (structural: lib/profiles never imports lib/auth). */
export interface ProfileSession { id: number; profile: string; activeProfileKind: string | null; sessionId: number | null }

import { availableCards, defaultProfileKind, navProfileOf, type ProfileCard, type ProfileKindKey } from './core'
import type { ProfileKind } from './nav'

export async function profilesOf(user: ProfileSession): Promise<ProfileCard[]> {
  const rows = await prisma.userProfile.findMany({ where: { userId: user.id }, select: { kind: true } })
  const kinds = rows.map((r) => r.kind)
  // Staff login implies the STAFF card even without a row.
  if (['admin', 'manager', 'operator', 'finance'].includes(user.profile) && !kinds.includes('STAFF')) kinds.push('STAFF')
  return availableCards(kinds)
}

/** Switches the active profile of THIS session; refuses kinds the user does not have. */
export async function switchProfile(user: ProfileSession, kind: ProfileKindKey): Promise<{ ok: true; nav: ProfileKind } | { ok: false; error: string }> {
  const cards = await profilesOf(user)
  if (!cards.some((c) => c.kind === kind)) return { ok: false, error: 'Perfil não disponível para esta conta.' }
  if (user.sessionId) await prisma.session.update({ where: { id: user.sessionId }, data: { activeProfileKind: kind } })
  return { ok: true, nav: navProfileOf(kind) }
}

/**
 * The NAV profile of the session: the kind picked in the switcher, else the
 * account's default profile (or the first one). null only for an account with
 * no profile at all — there is no "choose a profile" screen any more.
 */
export async function activeNavProfile(user: ProfileSession): Promise<ProfileKind | null> {
  if (user.activeProfileKind) return navProfileOf(user.activeProfileKind)
  const cards = await profilesOf(user)
  if (cards.length <= 1) return cards[0] ? navProfileOf(cards[0].kind) : null
  const def = await prisma.userProfile.findFirst({ where: { userId: user.id, isDefault: true }, select: { kind: true } })
  const kind = defaultProfileKind(cards, def?.kind ?? null)
  return kind ? navProfileOf(kind) : null
}

/**
 * Who the topbar shows (audit "Topbar": the person's or the gallery's name, never the profile kind):
 * the gallery's name for the gallery profile, else the person; and the person's photo.
 */
export async function shellIdentity(userId: number, nav: ProfileKind): Promise<{ name: string | null; avatarUrl: string | null }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true, member: { select: { kind: true, tenant: { select: { name: true } } } } } })
  if (!u) return { name: null, avatarUrl: null }
  const gallery = nav === 'gallery' && u.member?.kind === 'GALLERY_STAFF' ? u.member.tenant.name : null
  return { name: gallery ?? u.name, avatarUrl: u.avatarUrl }
}
