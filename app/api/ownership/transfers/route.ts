import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createTransfer, listTransfers } from '@/lib/ownership/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

const schema = z.object({ artworkId: z.number().int().positive(), toDocument: z.string().min(11).max(20), toEmail: z.string().max(254), toName: z.string().trim().min(3).max(120), priceCents: z.union([z.number(), z.string()]), priceSealed: z.boolean().default(false) })

export async function GET() {
  const gate = flagGate('FLAG_OWNERSHIP_TRANSFER'); if (gate) return gate
  try { const u = await requireAuth(); return json(await listTransfers(u.id)) } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request) {
  const gate = flagGate('FLAG_OWNERSHIP_TRANSFER'); if (gate) return gate
  try {
    const u = await requireAuth()
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    const r = await createTransfer(u.id, { ...parsed.data, priceCents: BigInt(Math.round(Number(String(parsed.data.priceCents).replace(/[^\d.]/g, '')))) })
    return json({ ok: true, ...r }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
