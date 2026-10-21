// Certificate-deed — PURE: canonical content, hashes, the event chain, the
// public projection. The chain: hash = sha256(prevHash + canonical(payload)).
import { canonical, chainHash, sha256Hex } from '@/lib/certificate-events/core'
export { canonical, chainHash, sha256Hex }

export const CERTIFICATE_STATUSES = ['DRAFT', 'ACTIVE', 'CONTESTED', 'REVOKED'] as const
export const EVENT_KINDS = ['CREATED', 'CERTIFIED', 'LISTED', 'TRANSFERRED', 'LOANED', 'RESTORED', 'STOLEN', 'DISPUTED', 'INSURED'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export const EVENT_LABELS: Record<EventKind, string> = {
  CREATED: 'Obra registrada', CERTIFIED: 'Certificado emitido', LISTED: 'Listada no marketplace', TRANSFERRED: 'Titularidade transferida',
  LOANED: 'Emprestada', RESTORED: 'Restauro registrado', STOLEN: 'Comunicada como roubada', DISPUTED: 'Contestada', INSURED: 'Segurada',
}

export interface CertificateContent {
  publicId: string
  artwork: { title: string; year: number | null; technique: string | null; materials: string | null; dimensionsMm: { h: number | null; w: number | null; d: number | null }; edition: string | null; category: string }
  artist: { name: string; slug: string }
  holder: { name: string; documentMask: string | null }
  media: { kind: string; sha256: string }[]
  condition: { grade: string | null; regions: { region: string; state: string; note: string }[] }
  issuedBy: 'HouseArt'
  version: number
}

export function contentHashOf(content: CertificateContent): string {
  return sha256Hex(canonical(content))
}

/** Merkle root of a list of hashes (duplicates the last when odd). Empty → sha256(''). */
export function merkleRoot(hashes: readonly string[]): string {
  if (hashes.length === 0) return sha256Hex('')
  let level = [...hashes]
  while (level.length > 1) {
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) next.push(sha256Hex(level[i] + (level[i + 1] ?? level[i])))
    level = next
  }
  return level[0]
}

/** Verifies the chain of events of a certificate in order. */
export function chainValid(events: readonly { payloadJson: string; hash: string; prevHash: string | null }[]): boolean {
  let prev: string | null = null
  for (const e of events) {
    if (e.prevHash !== prev) return false
    if (chainHash(prev, JSON.parse(e.payloadJson)) !== e.hash) return false
    prev = e.hash
  }
  return true
}

/** "Colecionador particular · desde 2026" — never the name of a private holder. */
export function holderLabel(holder: { kind: 'ARTIST' | 'GALLERY' | 'COLLECTOR'; name: string; since: Date }): string {
  const year = holder.since.getUTCFullYear()
  if (holder.kind === 'COLLECTOR') return `Colecionador particular · desde ${year}`
  return `${holder.name} · desde ${year}`
}
