// Onboarding preferences — pure: the allowlists of the "Interesses" step and the sanitizer.
export const PREFERENCE_USES = ['COLLECT', 'SELL', 'APPRAISE', 'DISCOVER', 'MANAGE_GALLERY'] as const
export const PREFERENCE_INTERESTS = ['PAINTING', 'SCULPTURE', 'PHOTOGRAPHY', 'PRINTS', 'DRAWING', 'DIGITAL', 'INSTALLATION', 'TEXTILE', 'CERAMICS', 'URBAN'] as const

export const USE_LABELS: Record<(typeof PREFERENCE_USES)[number], string> = {
  COLLECT: 'Colecionar obras autenticadas',
  SELL: 'Vender obras',
  APPRAISE: 'Avaliar obras que já tenho',
  DISCOVER: 'Descobrir artistas e galerias',
  MANAGE_GALLERY: 'Gerir o acervo de uma galeria',
}
export const INTEREST_LABELS: Record<(typeof PREFERENCE_INTERESTS)[number], string> = {
  PAINTING: 'Pintura', SCULPTURE: 'Escultura', PHOTOGRAPHY: 'Fotografia', PRINTS: 'Gravura', DRAWING: 'Desenho',
  DIGITAL: 'Arte digital', INSTALLATION: 'Instalação', TEXTILE: 'Têxtil', CERAMICS: 'Cerâmica', URBAN: 'Arte urbana',
}

export interface Preferences { uses: string[]; interests: string[]; city: string }

export function sanitizePreferences(raw: unknown): Preferences {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = (v: unknown, allow: readonly string[]) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allow.includes(x)))] : []
  const city = typeof o.city === 'string' ? o.city.trim().slice(0, 80) : ''
  return { uses: pick(o.uses, PREFERENCE_USES), interests: pick(o.interests, PREFERENCE_INTERESTS), city }
}
