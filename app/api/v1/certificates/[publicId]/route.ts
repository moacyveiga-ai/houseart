import { NextResponse } from 'next/server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicCertificate } from '@/lib/certificates/server'

export const dynamic = 'force-dynamic'

/** Public, read-only: what the verification page shows (no values, no documents). */
export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const publicId = (await ctx.params).publicId.toUpperCase()
  if (!isPublicId(publicId)) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const c = await publicCertificate(publicId)
  if (!c) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(c, { headers: { 'cache-control': 'public, max-age=60' } })
}
