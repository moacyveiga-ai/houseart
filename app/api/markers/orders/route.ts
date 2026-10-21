import { requirePanel } from '@/lib/auth/panel'
import { ordersOf, requestMarkers } from '@/lib/physical-markers/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

export async function GET() {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try { const { scope } = await requirePanel(); return json(await ordersOf(scope)) } catch (e) { return artworkErrorResponse(e) }
}

export async function POST(req: Request) {
  const gate = flagGate('FLAG_PHYSICAL_MARKERS'); if (gate) return gate
  try {
    const { scope } = await requirePanel()
    const body = await req.json().catch(() => ({})) as { quantity?: number }
    const order = await requestMarkers(scope, Number(body.quantity ?? 10))
    return json({ id: order.id, quantity: order.quantity, status: order.status }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
