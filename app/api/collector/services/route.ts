import { requireAuth } from '@/lib/auth'
import { artworkServices } from '@/lib/collectors/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

/** The services a collector can order for an artwork (prices from the catalog; QUOTE = no price). */
export async function GET() {
  try { await requireAuth(); return json({ items: await artworkServices() }) } catch (e) { return artworkErrorResponse(e) }
}
