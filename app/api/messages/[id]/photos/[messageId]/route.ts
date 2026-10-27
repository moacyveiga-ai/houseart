// The photo of a conversation line, streamed from the private vault — only to the two participants.
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { photoOf } from '@/lib/messaging/server'
import { openVaultFileStream, PrivateVaultUnavailableError } from '@/lib/storage/private-vault'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  try {
    const u = await requireAuth()
    const p = await ctx.params
    const id = idParam(p.id); const messageId = idParam(p.messageId)
    if (!id || !messageId) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    const ref = await photoOf(u.id, id, messageId)
    if (!ref) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    // a ref whose file left the vault is a missing photo, not a server error
    const file = await openVaultFileStream(ref).catch((e: unknown) => { if (e instanceof PrivateVaultUnavailableError) throw e; return null })
    if (!file) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    return new NextResponse(file.stream, { status: 200, headers: {
      'content-type': 'image/jpeg', ...(file.size !== null ? { 'content-length': String(file.size) } : {}),
      'content-disposition': 'inline; filename="foto.jpg"', 'x-content-type-options': 'nosniff', 'content-security-policy': 'sandbox', 'cache-control': 'private, max-age=3600',
    } })
  } catch (e) {
    if (e instanceof PrivateVaultUnavailableError) return NextResponse.json({ error: 'Foto indisponível agora.' }, { status: 503 })
    return artworkErrorResponse(e)
  }
}
