// Physical markers (NTAG 424 DNA) — allowlists and the public id. Pure.
export const MARKER_STATUSES = ['STOCK', 'SHIPPED', 'LINKED', 'REMOVED', 'REVOKED'] as const
export const BATCH_STATUSES = ['NEW', 'IN_USE', 'EXHAUSTED'] as const
export const BATCH_STATUS_LABELS: Record<(typeof BATCH_STATUSES)[number], string> = { NEW: 'Novo', IN_USE: 'Em uso', EXHAUSTED: 'Esgotado' }
export const MARKER_ORDER_STATUSES = ['REQUESTED', 'SHIPPED', 'DELIVERED'] as const
export const READ_PURPOSES = ['VERIFY', 'LINK', 'DELIVERY_CONFIRM', 'TRANSFER_CONFIRM'] as const
export type ReadPurpose = (typeof READ_PURPOSES)[number]

/** R$ 15 per marker; the kit of 10 is R$ 150. */
export const MARKER_UNIT_PRICE_CENTS = 1500n
export const MARKER_KIT_MIN = 1
export const MARKER_KIT_MAX = 200

/** Crockford base32 (no I, L, O, U). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** `HA-AAAA-XXXX-XXXX`: the year and 8 Crockford characters from random bytes. */
export function publicIdOf(year: number, randomBytes: Uint8Array): string {
  if (randomBytes.length < 5) throw new Error('publicId: 5 random bytes needed')
  let bits = 0n
  for (let i = 0; i < 5; i++) bits = (bits << 8n) | BigInt(randomBytes[i])
  let out = ''
  for (let i = 0; i < 8; i++) { out = CROCKFORD[Number(bits & 31n)] + out; bits >>= 5n }
  return `HA-${year}-${out.slice(0, 4)}-${out.slice(4)}`
}

export const PUBLIC_ID_RE = /^HA-\d{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export function isPublicId(v: string): boolean {
  return PUBLIC_ID_RE.test(v)
}

export const UID_RE = /^[0-9a-f]{14}$/i

/** The certification stage of an artwork ("Etiqueta pedida · recebida · vinculada · assinada · emitida"). */
export const CERT_STAGES = ['Enviada', 'Etiqueta pedida', 'Etiqueta recebida', 'Etiqueta vinculada', 'Assinado', 'Emitido'] as const

export interface StageFacts {
  submitted: boolean
  hasOrder: boolean
  orderDelivered: boolean
  linked: boolean
  signed: boolean
  issued: boolean
}

export function stageOf(f: StageFacts): number {
  if (f.issued) return 5
  if (f.signed) return 4
  if (f.linked) return 3
  if (f.orderDelivered) return 2
  if (f.hasOrder) return 1
  return 0
}

export type StageAction = 'WAIT_MARKER' | 'LINK_IN_APP' | 'SIGN' | 'ISSUE' | 'VIEW'

export function actionOf(stage: number): { label: string; action: StageAction } {
  if (stage <= 1) return { label: 'Aguardar etiqueta', action: 'WAIT_MARKER' }
  if (stage === 2) return { label: 'Vincular no app', action: 'LINK_IN_APP' }
  if (stage === 3) return { label: 'Assinar', action: 'SIGN' }
  if (stage === 4) return { label: 'Emitir', action: 'ISSUE' }
  return { label: 'Ver certificado', action: 'VIEW' }
}
