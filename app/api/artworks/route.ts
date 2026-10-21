import { requirePanel } from '@/lib/auth/panel'
import { createDraft, listArtworks } from '@/lib/artworks/server'
import { artworkErrorResponse, json } from './_http'

export async function GET(req: Request) {
  try {
    const { scope } = await requirePanel()
    const filter = new URL(req.url).searchParams.get('filter') ?? 'all'
    return json(await listArtworks(scope, { filter }))
  } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const { scope } = await requirePanel()
    const body = await req.json().catch(() => ({})) as { title?: string; artistId?: number }
    const a = await createDraft(scope, { title: body.title, artistId: body.artistId ?? null })
    return json({ id: a.id }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
