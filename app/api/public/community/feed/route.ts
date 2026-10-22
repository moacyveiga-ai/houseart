import { NextResponse } from 'next/server'
import { feed } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { userOrNull } from '@/app/api/messages/_http'

const TABS = ['ALL', 'SAVED', 'EVENTS', 'NEWS'] as const

/** Public to read (the viewer only adds "liked/saved/following"). */
export async function GET(req: Request) {
  try {
    const u = await userOrNull()
    const t = new URL(req.url).searchParams.get('tab') ?? 'ALL'
    const tab = (TABS as readonly string[]).includes(t) ? (t as (typeof TABS)[number]) : 'ALL'
    if (tab === 'SAVED' && !u) return NextResponse.json({ error: 'Entre para ver os salvos.' }, { status: 401 })
    return NextResponse.json({ items: await feed(u?.id ?? null, { tab }) })
  } catch (e) { return artworkErrorResponse(e) }
}
