// "Registrar restauro" (handoff "Web App" › Carteira de escrituras › ações) — PURE: the input of
// the sheet. The record goes to the certificate's event chain (RESTORED), so it is validated here
// once and never rewritten.
export interface RestorationInput { description: string; restorer: string | null; on: string | null }

const DAY = /^\d{4}-\d{2}-\d{2}$/
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
  if (on && (!DAY.test(on) || Number.isNaN(Date.parse(`${on}T12:00:00Z`)))) return { ok: false, error: 'Data inválida.' }
  if (on && on > today) return { ok: false, error: 'A data do restauro não pode estar no futuro.' }
  return { ok: true, value: { description, restorer, on: on || null } }
}
