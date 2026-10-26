// Admin review queue — the pure part (labels, tones, effect of each decision,
// relative time). The server (server.ts) applies the effects; the screen shows
// these texts before the staff confirms, so both read the same table.
export const REVIEW_KINDS = ['DUPLICATE', 'CONTESTATION', 'NEW_ISSUER', 'MARKER_REMOVED', 'EXPORT_RESTRICTION', 'MESSAGE_REPORT'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]
export type ReviewDecision = 'APPROVED' | 'REJECTED'

export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  DUPLICATE: 'Duplicidade', CONTESTATION: 'Contestação', NEW_ISSUER: 'Emissor novo', MARKER_REMOVED: 'Etiqueta removida', EXPORT_RESTRICTION: 'Restrição IPHAN', MESSAGE_REPORT: 'Denúncia em conversa',
}

/** Badge colours of the prototype (Admin · Obras e certificados), as token names. */
export const REVIEW_KIND_TONES: Record<ReviewKind, { bg: string; fg: string }> = {
  DUPLICATE: { bg: '--ha-pending-100', fg: '--ha-ink-900' },
  CONTESTATION: { bg: '--ha-alert-100', fg: '--ha-alert-500' },
  NEW_ISSUER: { bg: '--ha-paper-200', fg: '--ha-ink-900' },
  MARKER_REMOVED: { bg: '--ha-alert-500', fg: '--ha-paper-50' },
  EXPORT_RESTRICTION: { bg: '--ha-paper-200', fg: '--ha-ink-900' },
  MESSAGE_REPORT: { bg: '--ha-alert-100', fg: '--ha-alert-500' },
}

/** What each decision DOES — shown in the confirmation and applied by decideReviewItem. */
export const REVIEW_EFFECTS: Record<ReviewKind, Record<ReviewDecision, string>> = {
  DUPLICATE: {
    APPROVED: 'São obras diferentes. O cadastro segue normalmente.',
    REJECTED: 'É a mesma obra. O cadastro duplicado é arquivado e sai da certificação.',
  },
  CONTESTATION: {
    APPROVED: 'A contestação procede. O certificado é revogado e a obra fica como contestada, fora de venda.',
    REJECTED: 'A contestação não procede. O certificado volta a valer.',
  },
  NEW_ISSUER: {
    APPROVED: 'Portfólio conferido. A obra segue na certificação.',
    REJECTED: 'Portfólio não confere. A obra volta para rascunho e o emissor precisa reenviar.',
  },
  MARKER_REMOVED: {
    APPROVED: 'A etiqueta foi violada. Ela é revogada e a obra volta para a certificação, sem ID público, até receber outra.',
    REJECTED: 'Leitura falsa. A etiqueta segue valendo.',
  },
  EXPORT_RESTRICTION: {
    APPROVED: 'Restrição confirmada. Fica registrada na obra.',
    REJECTED: 'Sem restrição. Fica registrado que a obra foi conferida.',
  },
  MESSAGE_REPORT: {
    APPROVED: 'A denúncia procede. Fica registrada na conta denunciada e a equipe fala com a pessoa.',
    REJECTED: 'A denúncia não procede. Fica arquivada.',
  },
}

/** The decisions that undo something visible to the owner and therefore ask for a reason. */
export function needsReason(kind: ReviewKind, decision: ReviewDecision): boolean {
  if (kind === 'CONTESTATION' || kind === 'MARKER_REMOVED') return decision === 'APPROVED'
  return decision === 'REJECTED' && (kind === 'DUPLICATE' || kind === 'NEW_ISSUER')
}

/** "há 20 min", "há 2 h", "há 1 dia", "há 4 dias" (the prototype's "Aberto" column). */
export function openedAgo(now: Date, at: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}

/** "tempo médio 6 h" over the open items (null when the queue is empty). */
export function averageOpenHours(now: Date, opened: Date[]): number | null {
  if (!opened.length) return null
  const total = opened.reduce((s, d) => s + Math.max(0, now.getTime() - d.getTime()), 0)
  return Math.round(total / opened.length / 3_600_000)
}

/** "0,02% das obras" — the share with two decimals, pt-BR. */
export function shareLabel(part: number, whole: number): string {
  if (!whole) return '0% das obras'
  const pct = (part / whole) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% das obras`
}
