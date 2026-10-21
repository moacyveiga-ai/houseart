import { listPublicArtworks } from '@/lib/marketplace/public-server'
import { json } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const max = sp.get('maxPriceCents')
  return json(await listPublicArtworks({ category: sp.get('category'), maxPriceCents: max ? BigInt(max) : null, market: sp.get('market'), uf: sp.get('uf'), q: sp.get('q') }), { headers: { 'cache-control': 'public, max-age=30' } })
}
