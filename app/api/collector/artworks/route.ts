import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { registerOwnArtwork } from '@/lib/collectors/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { ACQUISITION_KINDS, type AcquisitionKind } from '@/lib/artworks/domain'

/** "Cadastrar obra" of the collector: origin + artist → a draft the register goes on with at /wallet/register?draft=<id> (photos, sheet, review). */
export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const kind = String(b.acquisitionKind ?? '') as AcquisitionKind
    if (!ACQUISITION_KINDS.includes(kind)) return NextResponse.json({ error: 'Diga como a obra chegou até você.' }, { status: 422 })
    const price = typeof b.acquisitionPriceCents === 'string' && /^\d{1,15}$/.test(b.acquisitionPriceCents) ? BigInt(b.acquisitionPriceCents) : typeof b.acquisitionPriceCents === 'number' && Number.isInteger(b.acquisitionPriceCents) && b.acquisitionPriceCents >= 0 ? BigInt(b.acquisitionPriceCents) : null
    const r = await registerOwnArtwork(u.id, {
      title: typeof b.title === 'string' ? b.title.slice(0, 200) : undefined,
      artistId: typeof b.artistId === 'number' && Number.isInteger(b.artistId) && b.artistId > 0 ? b.artistId : null,
      artistName: typeof b.artistName === 'string' ? b.artistName.slice(0, 120) : null,
      acquisitionKind: kind,
      acquisitionYear: typeof b.acquisitionYear === 'number' && Number.isInteger(b.acquisitionYear) && b.acquisitionYear > 1800 && b.acquisitionYear < 2200 ? b.acquisitionYear : null,
      acquisitionFrom: typeof b.acquisitionFrom === 'string' ? b.acquisitionFrom.slice(0, 160) : null,
      acquisitionNote: typeof b.acquisitionNote === 'string' ? b.acquisitionNote.slice(0, 500) : null,
      acquisitionPriceCents: price,
    })
    return NextResponse.json({ ok: true, id: r.id, href: `/wallet/register?draft=${r.id}` }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
