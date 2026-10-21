import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { sellerSign } from '@/lib/ownership/server'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_OWNERSHIP_TRANSFER'); if (gate) return gate
  try {
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Transferência não encontrada.' }, { status: 404 })
    const u = await requireAuth()
    await sellerSign(u.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
