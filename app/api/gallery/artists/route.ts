import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addArtist, representedArtists } from '@/lib/gallery/artists-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

const schema = z.object({ name: z.string().max(120), kind: z.string().max(20).optional(), galleryBps: z.number().int().optional(), validUntil: z.string().max(10).nullable().optional(), inviteEmail: z.string().max(254).nullable().optional() })

export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  try { return NextResponse.json({ ok: true, artists: await representedArtists(s.scope) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  try {
    const r = await addArtist(s.scope, parsed.data, { userId: s.user.id, name: s.user.name })
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json({ ok: true, id: r.id, artists: await representedArtists(s.scope) }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
