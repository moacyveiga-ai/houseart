import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, destroySession } from '@/lib/auth'

export async function POST(req: Request) {
  const store = await cookies()
  // The mobile app sends the session as a bearer (no cookie); both are destroyed the same way.
  const auth = req.headers.get('authorization')
  const token = store.get(COOKIE_NAME)?.value ?? (auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined)
  if (token) await destroySession(token)
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json')
  const res = wantsJson ? NextResponse.json({ ok: true }) : NextResponse.redirect(new URL('/login', req.url), 303)
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
