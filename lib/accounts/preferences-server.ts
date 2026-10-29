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
  // read-modify-write of one JSON column: the row is locked so the theme, "Sobre você" and this screen never erase each other
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ preferencesJson: string; termsAcceptedAt: Date | null }[]>`SELECT "preferencesJson", "termsAcceptedAt" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    const row = rows[0]
    if (!row) throw new Error('user not found')
    let others: Record<string, unknown> = {}
    try { others = JSON.parse(row.preferencesJson) as Record<string, unknown> } catch { others = {} }
    if (!others || typeof others !== 'object' || Array.isArray(others)) others = {}
    // keys this screen does not own (e.g. "Sobre você", lib/profile, the theme) are kept as they are
    const current = sanitizePreferences(others)
    const merged = sanitizePreferences({
      uses: input.uses ?? current.uses,
      interests: input.interests ?? current.interests,
      city: input.city ?? current.city,
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        preferencesJson: JSON.stringify({ ...others, ...merged }),
        ...(input.marketingOptIn === undefined ? {} : { marketingOptIn: input.marketingOptIn }),
        ...(input.termsAccepted ? { termsAcceptedAt: row.termsAcceptedAt ? undefined : new Date() } : {}),
      },
    })
  })
  return readPreferences(userId)
}

/** Perfil › Aparência: the theme follows the account to another device (kept next to the other keys). */
export async function saveTheme(userId: number, theme: Theme): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ preferencesJson: string }[]>`SELECT "preferencesJson" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    let all: Record<string, unknown> = {}
    try { all = JSON.parse(rows[0]?.preferencesJson ?? '{}') as Record<string, unknown> } catch { all = {} }
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {}
    await tx.user.update({ where: { id: userId }, data: { preferencesJson: JSON.stringify({ ...all, theme }) } })
  })
}

export { PREFERENCE_INTERESTS, PREFERENCE_USES }
