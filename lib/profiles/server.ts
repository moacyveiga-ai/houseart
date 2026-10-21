// Profile choice and switch (screen "Escolha de perfil").
import 'server-only'
import { prisma } from '@/lib/prisma'
/** The slice of the session this module reads (structural: lib/profiles never imports lib/auth). */
export interface ProfileSession { id: number; profile: string; activeProfileKind: string | null; sessionId: number | null }

import { availableCards, navProfileOf, type ProfileCard, type ProfileKindKey } from './core'
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

/** The NAV profile of the session: chosen kind, or the single/default one; null = must choose. */
export async function activeNavProfile(user: ProfileSession): Promise<ProfileKind | null> {
  if (user.activeProfileKind) return navProfileOf(user.activeProfileKind)
  const cards = await profilesOf(user)
  if (cards.length === 1) return navProfileOf(cards[0].kind)
  return null
}
