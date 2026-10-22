import { NextResponse } from 'next/server'
import { searchCertificates } from '@/lib/certificates/server'

export const dynamic = 'force-dynamic'

/**
 * Verificar of the mobile app: the public search of `app/verify` as JSON.
 * `?id=` (certificate number or the serial of the tag) or `?artist=&title=&year=`.
 * Only what the public results list prints: number, title, year, artist,
 * technique, cover and the verdict. No holder, no value, no document.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const id = (sp.get('id') ?? '').trim().slice(0, 80)
  const artist = (sp.get('artist') ?? '').trim().slice(0, 120)
  const title = (sp.get('title') ?? '').trim().slice(0, 200)
  const year = (sp.get('year') ?? '').trim().slice(0, 4)
  const byId = sp.has('id')
  if (byId ? !id : !artist && !title && !year) return NextResponse.json({ ok: true, results: [] })
  const results = await searchCertificates(byId ? { id: id.toUpperCase() } : { artist, title, year })
  return NextResponse.json({ ok: true, results }, { headers: { 'cache-control': 'no-store' } })
}
