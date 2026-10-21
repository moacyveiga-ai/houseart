import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { requirePanel } from '@/lib/auth/panel'
import { flagGate } from '@/app/api/_flags'
import { requestAppraisal } from '@/lib/appraisal/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

const schema = z.object({ artworkId: z.number().int().positive(), purpose: z.string().min(3).max(20).default('INSURANCE'), requesterLabel: z.string().min(3).max(40).default('Colecionador') })

/** "Pedir laudo": a holder (collector) or a member for an artwork in reach. */
export async function POST(req: Request) {
  const gate = flagGate('FLAG_APPRAISAL'); if (gate) return gate
  try {
    const user = await requireAuth()
    const scope = user.profile === 'collector' ? null : (await requirePanel()).scope
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    return json(await requestAppraisal({ userId: user.id, name: user.name, scope }, parsed.data), { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
