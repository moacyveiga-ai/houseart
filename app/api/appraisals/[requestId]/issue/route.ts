import { NextResponse } from 'next/server'
import { z } from 'zod'
import { flagGate } from '@/app/api/_flags'
import { issueAppraisal } from '@/lib/appraisal/server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'
import { requireAppraiser } from '../../_guard'

const cents = z.union([z.number(), z.string()]).transform((v) => BigInt(Math.round(Number(String(v).replace(/[^\d.-]/g, '')))))
const schema = z.object({ minCents: cents, suggestedCents: cents, maxCents: cents, methodology: z.string().max(4000), comparableIds: z.array(z.number().int().positive()).max(50).optional() })

export async function POST(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const gate = flagGate('FLAG_APPRAISAL'); if (gate) return gate
  try {
    const u = await requireAppraiser()
    const id = idParam((await ctx.params).requestId)
    if (!id) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    return json(await issueAppraisal({ userId: u.id, name: u.name, profile: u.profile }, id, parsed.data), { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
