// What the Entrar page says when the social login comes back with `?social=`
// (app/api/auth/oauth/[provider]/callback). Pure: a table, so the page and the
// test read the same words.
export const SOCIAL_MESSAGES: Record<string, string> = {
  state: 'A sessão do login social expirou. Tente de novo.',
  denied: 'Login cancelado no provedor.',
  failed: 'Não foi possível entrar com esse provedor.',
  'no-email': 'O provedor não informou um e-mail. Use outro meio.',
  inactive: 'Esta conta está desativada.',
  provider: 'Provedor desconhecido.',
}

/** The sentence for a `?social=` code; unknown or absent code → null (nothing is shown). */
export function socialMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return SOCIAL_MESSAGES[code] ?? null
}

/** Social providers as the Entrar page lists them (handoff order; MOCK only outside production). */
export const SOCIAL_BUTTONS = [
  { slug: 'google', key: 'GOOGLE', label: 'Continuar com Google' },
  { slug: 'apple', key: 'APPLE', label: 'Continuar com Apple' },
  { slug: 'facebook', key: 'FACEBOOK', label: 'Continuar com Facebook' },
  { slug: 'linkedin', key: 'LINKEDIN', label: 'Continuar com LinkedIn' },
] as const

/** Href of the start route for a provider, carrying the purpose and the safe `next`. */
export function socialStartHref(slug: string, purpose: 'login' | 'signup', next: string | null): string {
  const qs = new URLSearchParams({ purpose })
  if (next) qs.set('next', next)
  return `/api/auth/oauth/${slug}/start?${qs.toString()}`
}
