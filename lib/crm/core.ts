// CRM — PURE: the four Kanban columns and the offer → stage mapping.
export const STAGES = ['INTERESTED', 'IN_CONVERSATION', 'OFFER', 'CLOSED'] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_LABELS: Record<Stage, string> = { INTERESTED: 'Interessados', IN_CONVERSATION: 'Em conversa', OFFER: 'Proposta', CLOSED: 'Fechado' }

export function stageOfOfferStatus(status: string): { stage: Stage; outcome: 'WON' | 'LOST' | null } {
  switch (status) {
    case 'ACCEPTED': case 'IN_DEAL': case 'CONVERTED': return { stage: 'CLOSED', outcome: 'WON' }
    case 'REFUSED': case 'EXPIRED': case 'RETRACTED': case 'CANCELLED': return { stage: 'CLOSED', outcome: 'LOST' }
    case 'NEGOTIATING': return { stage: 'OFFER', outcome: null }
    default: return { stage: 'OFFER', outcome: null }
  }
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] ?? '' : '')).toUpperCase() || '?'
}

export function whenLabel(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })
}
