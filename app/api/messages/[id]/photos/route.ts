// "Enviar foto" in a conversation: multipart `file` → the new IMAGE line (the photo stays in the private vault).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sendPhoto } from '@/lib/messaging/server'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { fileOf } from '@/lib/public-content/editor-http'
import { ContentError } from '@/lib/public-content/editor-core'
import { PrivateVaultUnavailableError } from '@/lib/storage/private-vault'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '../../_http'

export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    const limited = await socialWriteLimit(u.id, 'photo'); if (limited) return limited
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, message: await sendPhoto(u.id, id, bytes) }, { status: 201 })
  } catch (e) {
    if (e instanceof ContentError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    if (e instanceof PrivateVaultUnavailableError) return NextResponse.json({ error: 'Envio de fotos indisponível agora.' }, { status: 503 })
    return artworkErrorResponse(e)
  }
}
