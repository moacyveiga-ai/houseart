import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { deleteAddress, saveAddress } from '@/lib/addresses/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Endereço não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true, address: await saveAddress(u.id, (await req.json().catch(() => ({}))) as Record<string, unknown>, id) })
  } catch (e) { return artworkErrorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Endereço não encontrado.' }, { status: 404 })
    await deleteAddress(u.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
