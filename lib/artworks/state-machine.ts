// Artwork state machine (ported from the origin's property machine):
// DRAFT → IN_CERTIFICATION → AUTHENTICATED → LISTED → IN_DEAL → SOLD, plus
// ARCHIVED and the provenance statuses STOLEN/DISPUTED. The guard of LISTED
// is the GREEN seal (certificate issued). Pure.
import type { ArtworkStatus } from './domain'

const TRANSITIONS: Record<ArtworkStatus, readonly ArtworkStatus[]> = {
  DRAFT: ['IN_CERTIFICATION', 'ARCHIVED'],
  IN_CERTIFICATION: ['AUTHENTICATED', 'DRAFT', 'ARCHIVED'],
  AUTHENTICATED: ['LISTED', 'ARCHIVED', 'STOLEN', 'DISPUTED'],
  LISTED: ['AUTHENTICATED', 'IN_DEAL', 'ARCHIVED', 'STOLEN', 'DISPUTED'],
  IN_DEAL: ['LISTED', 'SOLD', 'DISPUTED'],
  SOLD: ['AUTHENTICATED', 'STOLEN', 'DISPUTED'],
  ARCHIVED: ['DRAFT'],
  STOLEN: ['AUTHENTICATED'],
  DISPUTED: ['AUTHENTICATED', 'ARCHIVED'],
}

export interface TransitionContext { seal: string; hasLiveDeal?: boolean }

export type TransitionVerdict = { ok: true } | { ok: false; reason: 'INVALID_TRANSITION' | 'SEAL_REQUIRED' | 'LIVE_DEAL' }

export function canTransition(from: ArtworkStatus, to: ArtworkStatus, ctx: TransitionContext): TransitionVerdict {
  if (!TRANSITIONS[from].includes(to)) return { ok: false, reason: 'INVALID_TRANSITION' }
  if (to === 'LISTED' && ctx.seal !== 'GREEN') return { ok: false, reason: 'SEAL_REQUIRED' }
  if (from === 'IN_DEAL' && to !== 'SOLD' && to !== 'DISPUTED' && ctx.hasLiveDeal) return { ok: false, reason: 'LIVE_DEAL' }
  return { ok: true }
}

/** What the artist must fill before "Enviar para certificação". */
export interface SubmitInput {
  title: string
  artistId: number | null
  technique: string | null
  mediaKinds: readonly string[]
}

export function submitProblems(a: SubmitInput): string[] {
  const problems: string[] = []
  if (!a.title.trim()) problems.push('Informe o título.')
  if (!a.artistId) problems.push('Informe o artista.')
  if (!a.technique?.trim()) problems.push('Informe a técnica.')
  if (!a.mediaKinds.includes('FRONT_COLOR_CARD')) problems.push('Envie a foto frontal com cartão de cor.')
  if (!a.mediaKinds.includes('BACK')) problems.push('Envie a foto do verso.')
  return problems
}
