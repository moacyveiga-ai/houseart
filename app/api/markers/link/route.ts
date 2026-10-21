import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { linkMarker } from '@/lib/physical-markers/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

const schema = z.object({ uid: z.string().regex(/^[0-9a-fA-F]{14}$/), ctr: z.number().int().min(0).max(0xffffff), cmac: z.string().regex(/^[0-9a-fA-F]{16}$/), artworkId: z.number().int().positive() })

/** The app's tap: SUN message of the tag + the artwork being linked. */
export async function POST(req: Request) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const { scope, user } = await requirePanel()
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Leitura inválida.' }, { status: 400 })
    const r = await linkMarker(scope, parsed.data, { userId: user.id })
    return NextResponse.json({ ok: true, publicId: r.publicId })
  } catch (e) { return artworkErrorResponse(e) }
}
