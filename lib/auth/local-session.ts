// LOCAL session (legacy auth mode): the row in `Session` and the cookie options.
// The row stores `h1:` + sha256(token); the token only exists in the cookie.
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export const SESSION_DURATION_DAYS = 30
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
export const SESSION_KEY_PREFIX = 'h1:'

export function sessionTokenKey(cookieToken: string): string {
  return SESSION_KEY_PREFIX + createHash('sha256').update(cookieToken).digest('hex')
}

export interface LocalSessionContext { ip?: string | null; userAgent?: string | null; activeProfileKind?: string | null }

/** Creates the `Session` row (hash of the token) and returns the cookie value. */
export async function createLocalSession(userId: number, ctx: LocalSessionContext = {}): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      token: sessionTokenKey(token),
      userId,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      activeProfileKind: ctx.activeProfileKind ?? null,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  })
  return token
}

export function sessionCookieOptions(env: { NODE_ENV?: string } = process.env) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  }
}
