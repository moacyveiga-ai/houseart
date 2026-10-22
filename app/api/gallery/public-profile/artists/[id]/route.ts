// Perfil público de um artista representado SEM conta, editado pela galeria (só o ADMIN).
import { NextResponse } from 'next/server'
import { artistProfileView, galleryAdminTenant, representedArtistId, saveArtistProfile } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentErrorResponse, contentSession, idParam, noStore } from '@/lib/public-content/editor-http'

type Ctx = { params: Promise<{ id: string }> }
const notFound = () => NextResponse.json({ ok: false, error: 'Artista não encontrado.' }, { status: 404 })

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const s = await contentSession()
    const tenantId = await galleryAdminTenant(s.scope)
    const id = idParam((await ctx.params).id); if (!id) return notFound()
    return NextResponse.json({ ok: true, profile: await artistProfileView(await representedArtistId(tenantId, id)) }, noStore)
  } catch (e) { return contentErrorResponse(e) }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const s = await contentSession()
    const tenantId = await galleryAdminTenant(s.scope)
    const id = idParam((await ctx.params).id); if (!id) return notFound()
    const artistId = await representedArtistId(tenantId, id)
    return NextResponse.json({ ok: true, profile: await saveArtistProfile(artistId, await bodyOf(req), { ...actorOf(s, req), via: 'gallery' }) })
  } catch (e) { return contentErrorResponse(e) }
}
