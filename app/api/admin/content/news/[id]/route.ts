import { NextResponse } from 'next/server'
import { deleteNews, updateNews } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentEditorSession, contentErrorResponse, idParam } from '@/lib/public-content/editor-http'

type Ctx = { params: Promise<{ id: string }> }
const notFound = () => NextResponse.json({ ok: false, error: 'Notícia não encontrada.' }, { status: 404 })

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await contentEditorSession()
    const id = idParam((await ctx.params).id); if (!id) return notFound()
    return NextResponse.json({ ok: true, news: await updateNews(id, await bodyOf(req), actorOf(s, req)) })
  } catch (e) { return contentErrorResponse(e) }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await contentEditorSession()
    const id = idParam((await ctx.params).id); if (!id) return notFound()
    await deleteNews(id, actorOf(s, req))
    return NextResponse.json({ ok: true })
  } catch (e) { return contentErrorResponse(e) }
}
