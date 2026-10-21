// Plans — pure rules: usage bars and the artwork-registration gate.
import { USAGE_BARS_OF, USAGE_KEYS, USAGE_LABELS, type PlanAudience, type UsageKey } from './domain'

export interface UsageBar { key: UsageKey; label: string; used: number; limit: number | null; text: string; pct: number }

/** "38 de 60" bars; without a limit the bar shows the count alone and is never full. */
export function usageBars(audience: PlanAudience, limits: Partial<Record<UsageKey, number | null>>, counts: Partial<Record<UsageKey, number>>): UsageBar[] {
  return USAGE_BARS_OF[audience].map((key) => {
    const used = counts[key] ?? 0
    const limit = limits[key] ?? null
    const text = limit === null ? `${used}` : `${used} de ${limit}`
    const pct = limit === null || limit <= 0 ? (limit === 0 && used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100))
    return { key, label: USAGE_LABELS[key], used, limit, text, pct }
  })
}

/** May the member register one more artwork? (ARTWORKS limit of the plan; null = unlimited) */
export function artworkRegistrationGate(count: number, limit: number | null): { ok: true } | { ok: false; reason: string } {
  if (limit === null || count < limit) return { ok: true }
  return { ok: false, reason: `Seu plano permite ${limit} obras cadastradas. Mude de plano para cadastrar mais.` }
}

export function priceLabel(cents: bigint): string {
  return cents === 0n ? 'Grátis' : `R$ ${Number(cents / 100n).toLocaleString('pt-BR')}`
}

/** Month key in the house timezone (America/Bahia = UTC−3, no DST). */
export function monthKey(now = new Date()): string {
  const local = new Date(now.getTime() - 3 * 3_600_000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthRange(now = new Date()): { start: Date; end: Date } {
  const local = new Date(now.getTime() - 3 * 3_600_000)
  const y = local.getUTCFullYear(), m = local.getUTCMonth()
  return { start: new Date(Date.UTC(y, m, 1, 3)), end: new Date(Date.UTC(y, m + 1, 1, 3)) }
}

export const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// ── the public price cards ("Como funciona" › Preços) ──────────────────────
export const PLAN_AUDIENCE_LABELS: Record<PlanAudience, string> = { ARTIST: 'Artista', GALLERY: 'Galeria', ADVISOR: 'Consultor' }
const AUDIENCE_ORDER: readonly PlanAudience[] = ['ARTIST', 'GALLERY', 'ADVISOR']

/** Prototype order: artists, galleries, advisors; cheaper first within each. */
export function comparePublicPlans(a: { audience: PlanAudience; priceCents: bigint }, b: { audience: PlanAudience; priceCents: bigint }): number {
  const d = AUDIENCE_ORDER.indexOf(a.audience) - AUDIENCE_ORDER.indexOf(b.audience)
  return d !== 0 ? d : a.priceCents < b.priceCents ? -1 : a.priceCents > b.priceCents ? 1 : 0
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The feature lines of a price card, written from the plan's limits (null = unlimited; 0 = not included). */
export function planFeatureLines(limits: Partial<Record<UsageKey, number | null>>): string[] {
  const out: string[] = []
  for (const key of USAGE_KEYS) {
    if (!(key in limits)) continue
    const n = limits[key] ?? null
    if (key === 'ARTWORKS') out.push(n === null ? 'Obras ilimitadas' : `Até ${plural(n, 'obra cadastrada', 'obras cadastradas')}`)
    else if (key === 'TAGS_INCLUDED') { if (n === null) out.push('Etiquetas ilimitadas'); else if (n > 0) out.push(`${plural(n, 'etiqueta incluída', 'etiquetas incluídas')} por ano`) }
    else if (key === 'APPRAISALS_INCLUDED') { if (n === null) out.push('Laudos ilimitados'); else if (n > 0) out.push(plural(n, 'laudo incluído', 'laudos incluídos')) }
    else if (key === 'CERTIFICATIONS_MONTH') out.push(n === null ? 'Certificações ilimitadas' : `${plural(n, 'certificação', 'certificações')} por mês`)
    else if (key === 'VIEWING_ROOMS') { if (n === null) out.push('Viewing rooms ilimitados'); else if (n > 0) out.push(plural(n, 'viewing room', 'viewing rooms')) }
    else if (key === 'SEATS') { if (n === null) out.push('Usuários ilimitados'); else if (n > 0) out.push(n === 1 ? '1 usuário' : `Até ${n} usuários`) }
  }
  return out
}

export function planCtaLabel(name: string, priceCents: bigint): string {
  return priceCents === 0n ? 'Começar grátis' : `Assinar ${name}`
}
