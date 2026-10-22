import { NextResponse } from 'next/server'
import { setNewsFeatured } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentEditorSession, contentErrorResponse, idParam } from '@/lib/public-content/editor-http'

type Ctx = { params: Promise<{ id: string }> }

/** Body: { "featured": boolean }. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const s = await contentEditorSession()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ ok: false, error: 'Notícia não encontrada.' }, { status: 404 })
    const body = (await bodyOf(req)) as { featured?: unknown }
    if (typeof body.featured !== 'boolean') return NextResponse.json({ ok: false, error: 'Informe `featured`.' }, { status: 400 })
    return NextResponse.json({ ok: true, news: await setNewsFeatured(id, body.featured, actorOf(s, req)) })
  } catch (e) { return contentErrorResponse(e) }
}
