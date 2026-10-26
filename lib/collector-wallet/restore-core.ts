// "Registrar restauro" (handoff "Web App" › Carteira de escrituras › ações) — PURE: the input of
// the sheet. The record goes to the certificate's event chain (RESTORED), so it is validated here
// once and never rewritten.
export interface RestorationInput { description: string; restorer: string | null; on: string | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A real day of the calendar (V8 parses "2026-02-30" happily; the chain is immutable, so no). */
export function isCalendarDay(day: string): boolean {
  if (!DAY.test(day)) return false
  const t = Date.parse(`${day}T12:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === day
}

/** Restoration is written forever on the public chain: never while the work is stolen, disputed or
 *  inside a deal (the buyer already read the chain), nor on a certificate that is no longer ACTIVE. */
export const RESTORATION_BLOCKED_STATUSES = ['STOLEN', 'DISPUTED', 'IN_DEAL'] as const
export function restorationBlockReason(artworkStatus: string, certificateStatus: string | null): string | null {
  if (certificateStatus !== 'ACTIVE') return 'O certificado desta obra não está ativo.'
  if (artworkStatus === 'IN_DEAL') return 'A obra está em venda: registre o restauro depois do negócio.'
  if (artworkStatus === 'STOLEN' || artworkStatus === 'DISPUTED') return 'A obra está com furto comunicado ou contestação aberta.'
  return null
}
export const RESTORATION_DESCRIPTION_MIN = 10
export const RESTORATION_DESCRIPTION_MAX = 500

/** `today` is YYYY-MM-DD in the house timezone: a restoration cannot be dated in the future. */
export function parseRestorationInput(raw: unknown, today: string): { ok: true; value: RestorationInput } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
  const description = str(r.description)
  if (description.length < RESTORATION_DESCRIPTION_MIN) return { ok: false, error: `Descreva o restauro em pelo menos ${RESTORATION_DESCRIPTION_MIN} caracteres.` }
  if (description.length > RESTORATION_DESCRIPTION_MAX) return { ok: false, error: `A descrição vai até ${RESTORATION_DESCRIPTION_MAX} caracteres.` }
  const restorer = str(r.restorer).slice(0, 120) || null
  const on = str(r.on)
  if (on && !isCalendarDay(on)) return { ok: false, error: 'Data inválida.' }
  if (on && on > today) return { ok: false, error: 'A data do restauro não pode estar no futuro.' }
  return { ok: true, value: { description, restorer, on: on || null } }
}
