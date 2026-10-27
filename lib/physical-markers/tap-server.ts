// Physical markers — the key and the buyer's tap, shared by the verification page, the off-platform
// transfer (lib/ownership) and the delivery confirmation (lib/deals). One module so every tap checks
// the SAME key (the real master key with MARKER_VENDOR=ntag424, the dev key only with the mock) and
// consumes the read counter the same way.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { ArtworkError } from '@/lib/artworks/server'
import { mockMasterKey, verifySun } from './sun-core'

export function markerMasterKey(): Buffer {
  const vendor = process.env.MARKER_VENDOR ?? 'mock'
  if (vendor === 'mock') return mockMasterKey()
  // The 16-byte master key in base64 (HSM/KMS integration is a J item).
  const raw = process.env.MARKER_MASTER_KEY?.trim()
  if (!raw) throw new ArtworkError('MARKER_KEY', 'MARKER_MASTER_KEY não configurada.', 503)
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 16) throw new ArtworkError('MARKER_KEY', 'Chave mestra inválida.', 503)
  return key
}

/**
 * A buyer's tap on the linked marker: valid only when the SUN message verifies against the master
 * key AND the counter is consumed by compare-and-swap (`readCounter < ctr`), so a captured URL
 * cannot be replayed on the next confirmation nor two requests share one read. With the mock vendor
 * a tap without a SUN message is the simulated read of the web button.
 */
export async function verifyBuyerTap(marker: { id: number; uid: string; readCounter: number }, sun: { uid: string; ctr: number; cmac: string } | null): Promise<boolean> {
  if (!sun) return (process.env.MARKER_VENDOR ?? 'mock') === 'mock'
  if (sun.uid.toLowerCase() !== marker.uid) return false
  if (!verifySun({ master: markerMasterKey(), uid: marker.uid, counter: sun.ctr, cmac: sun.cmac, lastCounter: marker.readCounter }).ok) return false
  const r = await prisma.physicalMarker.updateMany({ where: { id: marker.id, readCounter: { lt: sun.ctr } }, data: { readCounter: sun.ctr, lastReadAt: new Date() } })
  return r.count === 1
}
