// A photo of the packed work (multipart `file`), kept in the private vault.
import { NextResponse } from 'next/server'
import { addPackagingPhoto } from '@/lib/deals/packaging-server'
import { CONTENT_IMAGE_MAX_BYTES, ContentError } from '@/lib/public-content/editor-core'
import { fileOf } from '@/lib/public-content/editor-http'
import { PrivateVaultUnavailableError } from '@/lib/storage/private-vault'
import { artworkErrorResponse, dealContext } from '../../../_http'

export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.side !== 'SELLER' || !c.scope) return NextResponse.json({ error: 'Só o vendedor registra a embalagem.' }, { status: 403 })
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, photo: await addPackagingPhoto(c.scope, c.id, bytes, c.user.id) }, { status: 201 })
  } catch (e) {
    if (e instanceof ContentError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    if (e instanceof PrivateVaultUnavailableError) return NextResponse.json({ error: 'Envio de fotos indisponível agora.' }, { status: 503 })
    return artworkErrorResponse(e)
  }
}
