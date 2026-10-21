// Appraisal — pure taxonomy (D.13, E.10). Comparables replace the per-m²
// base of the origin: there is no AVM, only registered sales of the same
// artist (platform deals/transfers) and catalog entries typed by hand.
export const APPRAISAL_PURPOSES = ['SALE', 'INSURANCE', 'INVENTORY', 'ESTATE', 'COLLATERAL'] as const
export type AppraisalPurpose = (typeof APPRAISAL_PURPOSES)[number]
export const PURPOSE_LABELS: Record<AppraisalPurpose, string> = { SALE: 'Venda', INSURANCE: 'Seguro', INVENTORY: 'Inventário', ESTATE: 'Partilha', COLLATERAL: 'Garantia' }

export const REQUEST_STATUSES = ['QUEUED', 'IN_PROGRESS', 'ISSUED', 'CANCELLED'] as const
export const APPRAISAL_STATUSES = ['DRAFT', 'ISSUED', 'SUPERSEDED'] as const
export const COMPARABLE_SOURCES = ['AUCTION', 'GALLERY', 'HOUSEART'] as const
export type ComparableSource = (typeof COMPARABLE_SOURCES)[number]
export const SOURCE_LABELS: Record<ComparableSource, string> = { AUCTION: 'Leilão', GALLERY: 'Galeria', HOUSEART: 'HouseArt' }

export const REQUESTER_LABELS = ['Colecionador', 'Galeria', 'Artista', 'Seguradora', 'Consultor'] as const

/** Days the appraiser has by default (the design's "prazo"). */
export const APPRAISAL_DUE_DAYS = 5

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** HA-L-AAAA-XXXX (no 0/O/1/I). */
export function appraisalCode(year: number, random: (n: number) => number[]): string {
  const body = random(4).map((v) => ALPHABET[v % ALPHABET.length]).join('')
  return `HA-L-${year}-${body}`
}

export function isAppraisalCode(v: string): boolean {
  return /^HA-L-\d{4}-[A-Z2-9]{4}$/.test(v)
}

export function isPurpose(v: string): v is AppraisalPurpose {
  return (APPRAISAL_PURPOSES as readonly string[]).includes(v)
}
