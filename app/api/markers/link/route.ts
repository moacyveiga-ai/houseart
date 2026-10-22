import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { linkMarker, simulatedSun } from '@/lib/physical-markers/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

const schema = z.object({ uid: z.string().regex(/^[0-9a-fA-F]{14}$/), ctr: z.number().int().min(0).max(0xffffff), cmac: z.string().regex(/^[0-9a-fA-F]{16}$/), artworkId: z.number().int().positive() })
/** Dev/CI only: `{ uid, artworkId, simulate: true }` stands for a tap when MARKER_VENDOR=mock outside production. */
const simulated = z.object({ uid: z.string().regex(/^[0-9a-fA-F]{14}$/), artworkId: z.number().int().positive(), simulate: z.literal(true) })

/** The app's tap: SUN message of the tag + the artwork being linked. */
export async function POST(req: Request) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const { scope, user } = await requirePanel()
    const body = await req.json().catch(() => ({}))
    const sim = simulated.safeParse(body)
    const read = sim.success ? (() => { const s = simulatedSun(sim.data.uid); return s ? { ...s, artworkId: sim.data.artworkId } : null })() : null
    const parsed = read ? { success: true as const, data: read } : schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Leitura inválida.' }, { status: 400 })
    const r = await linkMarker(scope, parsed.data, { userId: user.id })
    return NextResponse.json({ ok: true, publicId: r.publicId, certificateId: r.certificateId })
  } catch (e) { return artworkErrorResponse(e) }
}
