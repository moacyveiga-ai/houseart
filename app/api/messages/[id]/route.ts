import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { readConversation, sendMessage } from '@/lib/messaging/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { socialWriteLimit } from '../_http'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    const after = Number(new URL(req.url).searchParams.get('after') ?? 0) || 0
    return NextResponse.json(await readConversation(u.id, id, after))
  } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    const limited = await socialWriteLimit(u.id, 'send'); if (limited) return limited
    const body = (await req.json().catch(() => ({}))) as { body?: unknown }
    return NextResponse.json({ ok: true, message: await sendMessage(u.id, id, body.body) })
  } catch (e) { return artworkErrorResponse(e) }
}
