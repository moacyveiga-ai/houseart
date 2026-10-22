// Perfil público do PRÓPRIO artista (o membro dono do Artist): lê e grava inteiro.
import { NextResponse } from 'next/server'
import { artistProfileView, ownArtistId, saveArtistProfile } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentErrorResponse, contentSession, noStore } from '@/lib/public-content/editor-http'

export async function GET() {
  try {
    const s = await contentSession()
    return NextResponse.json({ ok: true, profile: await artistProfileView(await ownArtistId(s.scope)) }, noStore)
  } catch (e) { return contentErrorResponse(e) }
}

export async function PUT(req: Request) {
  try {
    const s = await contentSession()
    const id = await ownArtistId(s.scope)
    return NextResponse.json({ ok: true, profile: await saveArtistProfile(id, await bodyOf(req), { ...actorOf(s, req), via: 'artist' }) })
  } catch (e) { return contentErrorResponse(e) }
}
