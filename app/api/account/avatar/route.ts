// The profile photo (Perfil › Dados pessoais): multipart `file` → { url }; DELETE removes it.
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { audit, requestContext } from '@/lib/audit'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { contentErrorResponse, fileOf } from '@/lib/public-content/editor-http'
import { AvatarError, clearAvatar, setAvatar } from '@/lib/profile/server'
import { socialWriteLimit } from '@/app/api/messages/_http'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'avatar'); if (limited) return limited
    const url = await setAvatar(u.id, await fileOf(req, CONTENT_IMAGE_MAX_BYTES))
    void audit.event({ entity: 'user', entityId: String(u.id), action: 'avatar_set', userId: u.id, userName: u.name, ...requestContext(req) })
    return NextResponse.json({ ok: true, url }, { status: 201 })
  } catch (e) {
    if (e instanceof AvatarError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    return contentErrorResponse(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const u = await requireAuth()
    await clearAvatar(u.id)
    void audit.event({ entity: 'user', entityId: String(u.id), action: 'avatar_cleared', userId: u.id, userName: u.name, ...requestContext(req) })
    return NextResponse.json({ ok: true })
  } catch (e) { return contentErrorResponse(e) }
}
