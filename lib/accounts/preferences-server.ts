// Onboarding preferences of the account (signup step "Interesses"): uses,
// interests and city live in `User.preferencesJson` (allowlisted keys), the
// newsletter in `marketingOptIn`, the terms in `termsAcceptedAt`.
import { prisma } from '@/lib/prisma'
import { PREFERENCE_INTERESTS, PREFERENCE_USES, sanitizePreferences, type Preferences } from './preferences-core'
import { isTheme, type Theme } from '@/lib/theme-routes'

export async function readPreferences(userId: number): Promise<{ preferences: Preferences; marketingOptIn: boolean; termsAcceptedAt: string | null; phoneVerified: boolean; emailVerified: boolean; theme: Theme | null }> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true, marketingOptIn: true, termsAcceptedAt: true, phoneVerifiedAt: true, emailVerifiedAt: true } })
  let raw: unknown = {}
  try { raw = JSON.parse(u.preferencesJson) } catch { raw = {} }
  const theme = raw && typeof raw === 'object' ? (raw as { theme?: unknown }).theme : null
  return { preferences: sanitizePreferences(raw), marketingOptIn: u.marketingOptIn, termsAcceptedAt: u.termsAcceptedAt?.toISOString() ?? null, phoneVerified: !!u.phoneVerifiedAt, emailVerified: !!u.emailVerifiedAt, theme: isTheme(theme) ? theme : null }
}

export async function savePreferences(userId: number, input: { uses?: string[]; interests?: string[]; city?: string; marketingOptIn?: boolean; termsAccepted?: true }) {
  const current = await readPreferences(userId)
  // keys this screen does not own (e.g. "Sobre você", lib/profile) are kept as they are
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true } })
  let others: Record<string, unknown> = {}
  try { others = JSON.parse(row.preferencesJson) as Record<string, unknown> } catch { others = {} }
  if (!others || typeof others !== 'object' || Array.isArray(others)) others = {}
  const merged = sanitizePreferences({
    uses: input.uses ?? current.preferences.uses,
    interests: input.interests ?? current.preferences.interests,
    city: input.city ?? current.preferences.city,
  })
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferencesJson: JSON.stringify({ ...others, ...merged }),
      ...(input.marketingOptIn === undefined ? {} : { marketingOptIn: input.marketingOptIn }),
      ...(input.termsAccepted ? { termsAcceptedAt: current.termsAcceptedAt ? undefined : new Date() } : {}),
    },
  })
  return readPreferences(userId)
}

/** Perfil › Aparência: the theme follows the account to another device (kept next to the other keys). */
export async function saveTheme(userId: number, theme: Theme): Promise<void> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true } })
  let all: Record<string, unknown> = {}
  try { all = JSON.parse(row.preferencesJson) as Record<string, unknown> } catch { all = {} }
  if (!all || typeof all !== 'object' || Array.isArray(all)) all = {}
  await prisma.user.update({ where: { id: userId }, data: { preferencesJson: JSON.stringify({ ...all, theme }) } })
}

export { PREFERENCE_INTERESTS, PREFERENCE_USES }
