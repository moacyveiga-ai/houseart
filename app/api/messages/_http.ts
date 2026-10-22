import { NextResponse } from 'next/server'
import { requireAuth, type SessionUser } from '@/lib/auth'
import { consume, rateLimitResponse } from '@/lib/rate-limit'

/** Any logged person (collector, member, staff) — the module checks participation. */
export async function userOrNull(): Promise<SessionUser | null> {
  try { return await requireAuth() } catch { return null }
}

/** Writes in the social area: 30 per 5 min per user. */
export async function socialWriteLimit(userId: number, what: string): Promise<NextResponse | null> {
  const d = await consume({ key: `social:${what}:${userId}`, limit: 30, windowMs: 5 * 60_000 })
  return d.allowed ? null : rateLimitResponse(d, { error: 'Muitas ações em pouco tempo. Aguarde um pouco.' })
}
