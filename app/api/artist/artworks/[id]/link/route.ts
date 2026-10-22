import { NextResponse } from 'next/server'
import { getArtwork } from '@/lib/artworks/server'
import { certificateOfArtwork } from '@/lib/certificates/server'
import { simulatedSun } from '@/lib/physical-markers/server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '@/app/api/gallery/_http'
import { flagGate } from '@/app/api/_flags'

export const dynamic = 'force-dynamic'

/**
 * The head of "Vincular etiqueta" for the mobile app: the work (title, status,
 * public id once linked), the certificate the link created (for the signature)
 * and whether this environment takes a simulated tap — the same rule of
 * `POST /api/markers/link` (MARKER_VENDOR=mock outside production). Another
 * member's work is 404.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_CERTIFICATES') ?? flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const id = idParam((await ctx.params).id)
    const a = id ? await getArtwork(s.scope, id) : null
    if (!a) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const c = await certificateOfArtwork(s.scope, a.id)
    const title = `${a.title}${a.year ? `, ${a.year}` : ''}`
    return json({
      ok: true,
      artwork: { id: a.id, title, status: a.status, publicId: a.publicId },
      certificateId: c?.id ?? null,
      signed: !!c?.signedAt,
      issued: !!c?.issuedAt,
      simulateAllowed: simulatedSun('0'.repeat(14)) !== null,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
