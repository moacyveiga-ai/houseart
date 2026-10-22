// Onboarding preferences of the account (signup step "Interesses"): uses,
// interests and city live in `User.preferencesJson` (allowlisted keys), the
// newsletter in `marketingOptIn`, the terms in `termsAcceptedAt`.
import { prisma } from '@/lib/prisma'
import { PREFERENCE_INTERESTS, PREFERENCE_USES, sanitizePreferences, type Preferences } from './preferences-core'

export async function readPreferences(userId: number): Promise<{ preferences: Preferences; marketingOptIn: boolean; termsAcceptedAt: string | null; phoneVerified: boolean; emailVerified: boolean }> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true, marketingOptIn: true, termsAcceptedAt: true, phoneVerifiedAt: true, emailVerifiedAt: true } })
  let raw: unknown = {}
  try { raw = JSON.parse(u.preferencesJson) } catch { raw = {} }
  return { preferences: sanitizePreferences(raw), marketingOptIn: u.marketingOptIn, termsAcceptedAt: u.termsAcceptedAt?.toISOString() ?? null, phoneVerified: !!u.phoneVerifiedAt, emailVerified: !!u.emailVerifiedAt }
}

export async function savePreferences(userId: number, input: { uses?: string[]; interests?: string[]; city?: string; marketingOptIn?: boolean; termsAccepted?: true }) {
  const current = await readPreferences(userId)
  const merged = sanitizePreferences({
    uses: input.uses ?? current.preferences.uses,
    interests: input.interests ?? current.preferences.interests,
    city: input.city ?? current.preferences.city,
  })
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferencesJson: JSON.stringify(merged),
      ...(input.marketingOptIn === undefined ? {} : { marketingOptIn: input.marketingOptIn }),
      ...(input.termsAccepted ? { termsAcceptedAt: current.termsAcceptedAt ? undefined : new Date() } : {}),
    },
  })
  return readPreferences(userId)
}

export { PREFERENCE_INTERESTS, PREFERENCE_USES }
