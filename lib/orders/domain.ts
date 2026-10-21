// Orders — pure taxonomy (D.15). Prices live in ServiceCatalog (seeded).
export const SERVICE_CODES = ['CERTIFICATION', 'CERTIFICATION_BATCH', 'RECERTIFICATION', 'TAG_KIT', 'OFFPLATFORM_TRANSFER', 'APPRAISAL_SIGNED', 'APPRAISAL_FORENSIC', 'PROVENANCE_CHECK', 'SHIPPING', 'TRANSIT_INSURANCE', 'COLLECTION_INSURANCE', 'EXPORT_ASSIST', 'MARKETPLACE_FEATURE', 'PLAN_SUBSCRIPTION', 'PARTNER_SERVICE'] as const
export type ServiceCode = (typeof SERVICE_CODES)[number]

export const PAYER_KINDS = ['BUYER', 'SELLER', 'ARTIST', 'GALLERY', 'REQUESTER', 'OTHER'] as const
export type PayerKind = (typeof PAYER_KINDS)[number]

export const ORDER_STATUSES = ['OPEN', 'PAID', 'CANCELLED'] as const

export function orderCode(year: number, seq: number): string {
  return `ORD-${year}-${String(seq).padStart(6, '0')}`
}

export function isServiceCode(v: string): v is ServiceCode {
  return (SERVICE_CODES as readonly string[]).includes(v)
}
