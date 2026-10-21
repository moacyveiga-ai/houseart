// HTTP edge of the auth errors: one place that turns AuthError into 401/403
// and anything else into a 500 without the message.
import { NextResponse } from 'next/server'
import { AuthError } from './index'

export function authErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
  return null
}

export function errorResponse(e: unknown): NextResponse {
  const auth = authErrorResponse(e)
  if (auth) return auth
  console.error('[route] unhandled', e instanceof Error ? e.name : e)
  return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
}
