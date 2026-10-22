// Upload de imagem do perfil público do artista (foto, capas de publicação).
import { NextResponse } from 'next/server'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { ownArtistId, uploadContentImage } from '@/lib/public-content/editor-server'
import { actorOf, contentErrorResponse, contentSession, fileOf } from '@/lib/public-content/editor-http'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const s = await contentSession()
    const id = await ownArtistId(s.scope)
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, ...(await uploadContentImage(`artists/${id}`, bytes, actorOf(s, req))) }, { status: 201 })
  } catch (e) { return contentErrorResponse(e) }
}
