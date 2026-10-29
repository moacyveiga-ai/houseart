// Signup — pure: the plan summary of the ink aside (HouseArt Cadastro.dc.html
// › "Plano escolhido"), written from the public plans of the base. The
// prototype's texts (short name, note, CTA) are derived from code and price.
export type SignupProfileKind = 'ARTIST' | 'GALLERY' | 'ADVISOR' | 'COLLECTOR'

export interface SignupPlan {
  code: string
  name: string
  /** Chip label of the aside ("Grátis", "Ateliê", "Galeria Pro"…). */
  short: string
  /** "R$ 49" — integer reais, no cents (the prototype). */
  price: string
  /** "/mês" or "" for the free plan. */
  per: string
  note: string
  cta: string
  profileKind: SignupProfileKind
}

export const DEFAULT_SIGNUP_PLAN = 'ARTIST_STUDIO'

const AUDIENCE_PROFILE: Record<string, SignupProfileKind> = { ARTIST: 'ARTIST', GALLERY: 'GALLERY', ADVISOR: 'ADVISOR' }

export function toSignupPlan(p: { code: string; name: string; audience: string; priceCents: bigint | number; features: string[] }): SignupPlan {
  const cents = Number(p.priceCents)
  const free = cents === 0
  const reais = Math.round(cents / 100)
  return {
    code: p.code,
    name: free && p.audience === 'ARTIST' ? `${p.name} Grátis` : p.name,
    short: free ? 'Grátis' : p.name,
    price: `R$ ${reais.toLocaleString('pt-BR')}`,
    per: free ? '' : '/mês',
    note: free
      ? `Sem cartão de crédito. ${p.features[0] ?? 'Comece agora.'}`
      : p.code === 'GALLERY_PRO'
        ? 'Onboarding assistido com a equipe HouseArt.'
        : '14 dias grátis. Cancele quando quiser.',
    cta: free ? 'Criar conta grátis' : 'Começar 14 dias grátis',
    profileKind: AUDIENCE_PROFILE[p.audience] ?? 'COLLECTOR',
  }
}

/**
 * The plan of the aside: the one asked for, else the default (Ateliê), else — when the team switched the
 * default off in the catalog — the first artist plan still on, and only then whatever plan is on. Never a
 * gallery plan by accident of order when an artist plan exists.
 */
export function pickSignupPlan(plans: SignupPlan[], code: string | undefined): SignupPlan | null {
  if (plans.length === 0) return null
  return plans.find((p) => p.code === code)
    ?? plans.find((p) => p.code === DEFAULT_SIGNUP_PLAN)
    ?? plans.find((p) => p.profileKind === 'ARTIST')
    ?? plans[0]
}
