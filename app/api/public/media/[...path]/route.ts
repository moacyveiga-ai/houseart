// Public derivatives kept in the private store (no public Blob store configured).
// No session: these are the same bytes a public store would serve. Immutable
// cache so the CDN keeps them after the first hit.
import { NextResponse } from 'next/server'
import { isPublicMediaKey, readPublicMedia } from '@/lib/storage/blob'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const key = (await ctx.params).path.join('/')
  if (!isPublicMediaKey(key)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  const media = await readPublicMedia(key).catch(() => null)
  if (!media) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  return new NextResponse(new Uint8Array(media.bytes), {
    status: 200,
    headers: { 'content-type': media.contentType, 'content-length': String(media.bytes.length), 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  })
}
