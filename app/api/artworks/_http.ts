import { NextResponse } from 'next/server'
import { authErrorResponse } from '@/lib/auth/route'
import { ArtworkError } from '@/lib/artworks/server'

export function artworkErrorResponse(e: unknown): NextResponse {
  const auth = authErrorResponse(e)
  if (auth) return auth
  if (e instanceof ArtworkError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
  console.error('[artworks] unhandled', e instanceof Error ? e.name : e)
  return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
}

export function idParam(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null
}

/** JSON with BigInt as string. */
export function json(data: unknown, init?: ResponseInit): NextResponse {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
}
