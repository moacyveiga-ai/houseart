// Perfil público da galeria (só o ADMIN da galeria): lê e grava inteiro.
import { NextResponse } from 'next/server'
import { galleryAdminTenant, galleryProfileView, saveGalleryProfile } from '@/lib/public-content/editor-server'
import { actorOf, bodyOf, contentErrorResponse, contentSession, noStore } from '@/lib/public-content/editor-http'

export async function GET() {
  try {
    const s = await contentSession()
    return NextResponse.json({ ok: true, profile: await galleryProfileView(await galleryAdminTenant(s.scope)) }, noStore)
  } catch (e) { return contentErrorResponse(e) }
}

export async function PUT(req: Request) {
  try {
    const s = await contentSession()
    const tenantId = await galleryAdminTenant(s.scope)
    return NextResponse.json({ ok: true, profile: await saveGalleryProfile(tenantId, await bodyOf(req), actorOf(s, req)) })
  } catch (e) { return contentErrorResponse(e) }
}
