// Plans — pure taxonomy (D.16). Prices and limits live in the Plan/PlanFeature
// rows seeded by the migration; here only the codes, the audiences and the
// usage bars each audience shows on the "Cobrança" screen.
export const PLAN_CODES = ['ARTIST_FREE', 'ARTIST_STUDIO', 'GALLERY', 'GALLERY_PRO', 'ADVISOR'] as const
export type PlanCode = (typeof PLAN_CODES)[number]

export const PLAN_AUDIENCES = ['ARTIST', 'GALLERY', 'ADVISOR'] as const
export type PlanAudience = (typeof PLAN_AUDIENCES)[number]

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'CANCELLED', 'PAST_DUE'] as const

export const USAGE_KEYS = ['ARTWORKS', 'TAGS_INCLUDED', 'APPRAISALS_INCLUDED', 'CERTIFICATIONS_MONTH', 'VIEWING_ROOMS', 'SEATS'] as const
export type UsageKey = (typeof USAGE_KEYS)[number]

/** The bar labels of the design ("Uso em outubro"). */
export const USAGE_LABELS: Record<UsageKey, string> = {
  ARTWORKS: 'Obras cadastradas',
  TAGS_INCLUDED: 'Etiquetas disponíveis',
  APPRAISALS_INCLUDED: 'Laudos incluídos',
  CERTIFICATIONS_MONTH: 'Certificações no mês',
  VIEWING_ROOMS: 'Viewing rooms ativos',
  SEATS: 'Assentos da equipe',
}

/** Which bars each audience shows, in the design's order. */
export const USAGE_BARS_OF: Record<PlanAudience, readonly UsageKey[]> = {
  ARTIST: ['ARTWORKS', 'TAGS_INCLUDED', 'APPRAISALS_INCLUDED'],
  GALLERY: ['CERTIFICATIONS_MONTH', 'VIEWING_ROOMS', 'SEATS'],
  ADVISOR: ['CERTIFICATIONS_MONTH', 'VIEWING_ROOMS', 'SEATS'],
}

/** The free plan a tenant has before choosing one. */
export function defaultPlanFor(audience: PlanAudience): PlanCode {
  return audience === 'ARTIST' ? 'ARTIST_FREE' : audience === 'ADVISOR' ? 'ADVISOR' : 'GALLERY'
}

/** Member.kind → plan audience. */
export function audienceOfMemberKind(kind: string): PlanAudience {
  return kind === 'ARTIST' || kind === 'COLLECTOR' ? 'ARTIST' : kind === 'ADVISOR' ? 'ADVISOR' : 'GALLERY'
}

export function isPlanCode(v: string): v is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(v)
}
