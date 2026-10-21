import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { uploadMedia } from '@/lib/artworks/media-server'
import { isMediaKind, MAX_MASTER_BYTES } from '@/lib/artworks/media-core'
import { artworkErrorResponse, idParam, json } from '../../_http'

export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const declared = Number(req.headers.get('content-length') ?? 0)
    if (declared > MAX_MASTER_BYTES + 1024 * 1024) return NextResponse.json({ error: 'Arquivo acima de 50 MB.' }, { status: 413 })
    const form = await req.formData()
    const kind = String(form.get('kind') ?? '')
    const file = form.get('file')
    if (!isMediaKind(kind) || !(file instanceof File)) return NextResponse.json({ error: 'Envie `kind` e `file`.' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const r = await uploadMedia(scope, id, kind, { bytes, declaredType: file.type || null })
    return json({ media: { id: r.media.id, kind: r.media.kind, publicUrl: r.media.publicUrl, quality: r.media.quality, width: r.media.width, height: r.media.height }, duplicates: r.duplicates }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
