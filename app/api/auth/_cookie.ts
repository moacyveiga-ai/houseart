import { NextResponse } from 'next/server'
import { COOKIE_NAME, sessionCookieOptions, type SessionUser } from '@/lib/auth'

/** The login response: cookie + the public projection of the user (never the CPF). */
export function sessionResponse(user: SessionUser, token: string, next: string | null = null, remember = true): NextResponse {
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, profile: user.profile, activeProfileKind: user.activeProfileKind }, next })
  // "Manter conectado" off = session cookie (dies with the browser); the row still expires in 30 days.
  const { maxAge, ...rest } = sessionCookieOptions()
  res.cookies.set(COOKIE_NAME, token, remember ? { ...rest, maxAge } : rest)
  return res
}
