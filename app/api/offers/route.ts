import { requirePanel } from '@/lib/auth/panel'
import { sellerOffers } from '@/lib/offers/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

export async function GET() {
  try { const { scope } = await requirePanel(); return json(await sellerOffers(scope)) } catch (e) { return artworkErrorResponse(e) }
}
