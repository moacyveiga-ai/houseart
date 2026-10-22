import { NextResponse } from 'next/server'
import { z } from 'zod'
import { endRepresentation, representedArtists, updateContract } from '@/lib/gallery/artists-server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../../_http'

type Ctx = { params: Promise<{ id: string }> }
const schema = z.object({ kind: z.string().max(20).optional(), galleryBps: z.number().int().optional(), validUntil: z.string().max(10).nullable().optional() })

export async function PATCH(req: Request, ctx: Ctx) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  try {
    const ok = await updateContract(s.scope, id, parsed.data, { userId: s.user.id })
    return NextResponse.json({ ok, artists: await representedArtists(s.scope) }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  try {
    const ok = await endRepresentation(s.scope, id, { userId: s.user.id })
    return NextResponse.json({ ok, artists: await representedArtists(s.scope) }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
