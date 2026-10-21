import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { flagGate } from '@/app/api/_flags'
import { changePlan } from '@/lib/plans/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

const schema = z.object({ code: z.string().min(3).max(30) })

export async function POST(req: Request) {
  const gate = flagGate('FLAG_PLANS'); if (gate) return gate
  try {
    const { scope, user } = await requirePanel()
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    return json(await changePlan(scope, parsed.data.code, { userId: user.id }))
  } catch (e) { return artworkErrorResponse(e) }
}
