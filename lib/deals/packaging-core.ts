// "Registrar embalagem e condition report" (audit galeria §4): the rules of the seller's record of the
// packed work before shipping. PURE.
import type { DealPhase } from './domain'

export const PACKAGING_MAX_PHOTOS = 6
export const CONDITION_REPORT_MIN = 10
export const CONDITION_REPORT_MAX = 1000

/** Packing happens after the escrow is paid and before the carrier picks the work up. */
export function canRecordPackaging(phase: DealPhase, exception: string | null): boolean {
  return !exception && (phase === 'ESCROW' || phase === 'DOCUMENTS')
}

/** The condition note: trimmed, inside the limits, or the reason it is refused. */
export function conditionReportOf(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text.length < CONDITION_REPORT_MIN) return { ok: false, error: `Descreva o estado da obra (mínimo de ${CONDITION_REPORT_MIN} caracteres).` }
  if (text.length > CONDITION_REPORT_MAX) return { ok: false, error: `O condition report tem até ${CONDITION_REPORT_MAX} caracteres.` }
  return { ok: true, text }
}

export function packagingPhotoUrl(dealId: number, photoId: number): string {
  return `/api/deals/${dealId}/packaging/photos/${photoId}`
}
