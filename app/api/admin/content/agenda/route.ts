// Agenda do site (equipe da casa): lista e cria.
import { NextResponse } from 'next/server'
import { createAgendaEvent, listAgendaForEditor } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentEditorSession, contentErrorResponse, noStore } from '@/lib/public-content/editor-http'

export async function GET() {
  try {
    await contentEditorSession()
    return NextResponse.json({ ok: true, events: await listAgendaForEditor() }, noStore)
  } catch (e) { return contentErrorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const s = await contentEditorSession()
    return NextResponse.json({ ok: true, event: await createAgendaEvent(await bodyOf(req), actorOf(s, req)) }, { status: 201 })
  } catch (e) { return contentErrorResponse(e) }
}
