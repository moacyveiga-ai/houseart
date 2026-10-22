import { search } from '@/lib/search/server'
import { json } from '@/app/api/artworks/_http'

export async function GET(req: Request) {
  return json(await search(new URL(req.url).searchParams.get('q')))
}
