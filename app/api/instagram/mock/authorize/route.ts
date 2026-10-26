import { NextResponse } from 'next/server'
import { instagramMode } from '@/lib/instagram/core'
import { publicBaseUrl } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

/** Dev/CI only (INSTAGRAM_MOCK=1, never in production): "authorizes" at once and goes back to the callback. */
export async function GET(req: Request) {
  if (instagramMode(process.env) !== 'MOCK') return NextResponse.json({ ok: false, error: 'Não encontrado' }, { status: 404 })
  const state = new URL(req.url).searchParams.get('state') ?? ''
  return NextResponse.redirect(`${publicBaseUrl()}/api/instagram/callback?code=mock&state=${encodeURIComponent(state)}`)
}
