// "Cadastrar obra" of the gallery: origin + artist → a draft the register goes on with at
// /artworks/register?draft=<id> (photos, sheet, review through the artwork routes).
import { NextResponse } from 'next/server'
import { registerGalleryArtwork } from '@/lib/gallery/register-server'
import { GALLERY_SOURCE_KINDS, type GallerySourceKind } from '@/lib/artworks/domain'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const kind = String(b.sourceKind ?? b.acquisitionKind ?? '') as GallerySourceKind
    if (!GALLERY_SOURCE_KINDS.includes(kind)) return NextResponse.json({ ok: false, error: 'Diga de onde vem esta obra.' }, { status: 422 })
    const r = await registerGalleryArtwork(s.scope, {
      sourceKind: kind,
      artistId: typeof b.artistId === 'number' && Number.isInteger(b.artistId) && b.artistId > 0 ? b.artistId : null,
      artistName: typeof b.artistName === 'string' ? b.artistName.slice(0, 120) : null,
    })
    return NextResponse.json({ ok: true, id: r.id, href: `/artworks/register?draft=${r.id}` }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
