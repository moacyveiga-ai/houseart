// Conta da galeria › Dados da galeria: the ADMIN saves e-mail, celular, cidade and the summary
// (the public profile of the gallery; name and CNPJ are locked).
import { NextResponse } from 'next/server'
import { saveGalleryAccountData } from '@/lib/gallery/account-server'
import { actorOf, bodyOf, contentErrorResponse, contentSession, noStore } from '@/lib/public-content/editor-http'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { ArtworkError } from '@/lib/artworks/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
  try {
    const s = await contentSession()
    const actor = actorOf(s, req)
    return NextResponse.json({ ok: true, data: await saveGalleryAccountData(s.scope, await bodyOf(req), { userId: actor.userId, name: actor.userName, ip: actor.ip, userAgent: actor.userAgent }) }, noStore)
  } catch (e) { return e instanceof ArtworkError ? artworkErrorResponse(e) : contentErrorResponse(e) }
}
