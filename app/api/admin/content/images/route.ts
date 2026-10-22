// Upload de imagem das notícias (equipe da casa): multipart `file` → { url } da derivada pública.
import { NextResponse } from 'next/server'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { uploadContentImage } from '@/lib/public-content/editor-server'
import { actorOf, contentEditorSession, contentErrorResponse, fileOf } from '@/lib/public-content/editor-http'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const s = await contentEditorSession()
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, ...(await uploadContentImage('news', bytes, actorOf(s, req))) }, { status: 201 })
  } catch (e) { return contentErrorResponse(e) }
}
