import { certificateOfArtwork, certificationView } from '@/lib/certificates/server'
import { CERT_STAGES } from '@/lib/physical-markers/domain'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '@/app/api/gallery/_http'
import { flagGate } from '@/app/api/_flags'

export const dynamic = 'force-dynamic'

/**
 * "Carteira de escrituras" of the artist for the mobile app: the works of the
 * scope in certification or certified (the web Certificação view), each with
 * the stage, the next action and the number of the active version of the
 * certificate. No content hash, no signature, no holder document.
 */
export async function GET() {
  const gate = flagGate('FLAG_CERTIFICATES'); if (gate) return gate
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const view = await certificationView(s.scope)
    const versions = await Promise.all(view.items.map((i) => (i.stage >= 5 ? certificateOfArtwork(s.scope, i.id).then((c) => c?.versions[0]?.version ?? null).catch(() => null) : Promise.resolve(null))))
    const items = view.items.map((i, n) => ({ artworkId: i.id, certificateId: i.certificateId, title: i.title, publicId: i.publicId, coverUrl: i.cover, status: i.status, stage: i.stage, stageLabel: CERT_STAGES[i.stage] ?? CERT_STAGES[0], action: i.action, actionLabel: i.label, version: versions[n] }))
    const orders = view.orders.map((o) => ({ id: o.id, quantity: o.quantity, status: o.status, createdAt: o.createdAt }))
    return json({ ok: true, items, orders }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
