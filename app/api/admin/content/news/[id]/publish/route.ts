import { NextResponse } from 'next/server'
import { setNewsPublished } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentEditorSession, contentErrorResponse, idParam } from '@/lib/public-content/editor-http'

type Ctx = { params: Promise<{ id: string }> }

/** Body: { "published": boolean }. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const s = await contentEditorSession()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ ok: false, error: 'Notícia não encontrada.' }, { status: 404 })
    const body = (await bodyOf(req)) as { published?: unknown }
    if (typeof body.published !== 'boolean') return NextResponse.json({ ok: false, error: 'Informe `published`.' }, { status: 400 })
    return NextResponse.json({ ok: true, news: await setNewsPublished(id, body.published, actorOf(s, req)) })
  } catch (e) { return contentErrorResponse(e) }
}
