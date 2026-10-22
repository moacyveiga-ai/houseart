// Upload de imagem do perfil público da galeria (capa, fotos, salas, equipe, capas)
// e dos artistas representados sem conta.
import { NextResponse } from 'next/server'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { galleryAdminTenant, uploadContentImage } from '@/lib/public-content/editor-server'
import { actorOf, contentErrorResponse, contentSession, fileOf } from '@/lib/public-content/editor-http'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const s = await contentSession()
    const tenantId = await galleryAdminTenant(s.scope)
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, ...(await uploadContentImage(`galleries/${tenantId}`, bytes, actorOf(s, req))) }, { status: 201 })
  } catch (e) { return contentErrorResponse(e) }
}
