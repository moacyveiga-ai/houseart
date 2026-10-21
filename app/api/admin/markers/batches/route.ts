import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/auth'
import { createBatch } from '@/lib/physical-markers/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

const schema = z.object({ code: z.string().min(7).max(20), quantity: z.number().int().min(1).max(100_000), destination: z.string().trim().min(1).max(120), tenantId: z.number().int().positive().nullable().optional(), uids: z.array(z.string()).max(100_000).optional() })

export async function POST(req: Request) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const user = await requireStaff()
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    const b = await createBatch(parsed.data, { userId: user.id, name: user.name })
    return NextResponse.json({ id: b.id, code: b.code }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
