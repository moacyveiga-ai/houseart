import { requirePanel } from '@/lib/auth/panel'
import { billingView } from '@/lib/billing/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

export async function GET() {
  try {
    const { scope, user } = await requirePanel()
    return json(await billingView(scope, user.id))
  } catch (e) { return artworkErrorResponse(e) }
}
