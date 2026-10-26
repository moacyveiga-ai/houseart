// The photo of a community post: multipart `file` → { url } of the public derivative (re-encoded JPEG, no EXIF).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { CONTENT_IMAGE_MAX_BYTES } from '@/lib/public-content/editor-core'
import { uploadContentImage } from '@/lib/public-content/editor-server'
import { contentErrorResponse, fileOf } from '@/lib/public-content/editor-http'
import { socialWriteLimit } from '@/app/api/messages/_http'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const limited = await socialWriteLimit(u.id, 'image'); if (limited) return limited
    const bytes = await fileOf(req, CONTENT_IMAGE_MAX_BYTES)
    return NextResponse.json({ ok: true, ...(await uploadContentImage('community', bytes, { userId: u.id, userName: u.name, ...requestContext(req) })) }, { status: 201 })
  } catch (e) { return contentErrorResponse(e) }
}
