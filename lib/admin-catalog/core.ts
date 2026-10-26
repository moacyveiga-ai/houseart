// Admin › Catálogo — pure rules (audit 2026-10-25, web-app §5 "Catálogo (planos, serviços, preço de
// etiqueta): só por SQL/seed"). Who edits, the limits of each field, the two inputs parsed from the
// request body, which plan can never be switched off, and the labels of the screen.
import { canApproveMembers } from '@/lib/auth/profiles'
import { USAGE_KEYS, USAGE_LABELS, defaultPlanFor, PLAN_AUDIENCES, type PlanAudience, type UsageKey } from '@/lib/plans/domain'

/** Admin and manager edit; the rest of the staff reads. */
export const canEditCatalog = canApproveMembers

export const NAME_MAX = 80
export const DESCRIPTION_MAX = 300
/** R$ 1.000.000,00 — a typo guard, not a business rule. */
export const PRICE_MAX_CENTS = 100_000_000
export const LIMIT_MAX = 100_000

export const SERVICE_UNITS = ['UNIT', 'WEEK', 'QUOTE'] as const
export type ServiceUnit = (typeof SERVICE_UNITS)[number]
export const SERVICE_UNIT_LABELS: Record<ServiceUnit, string> = { UNIT: 'por unidade', WEEK: 'por semana', QUOTE: 'sob orçamento' }

/** What the code drives elsewhere in the product — said on the row so the desk knows what a change touches. */
export const SERVICE_ROLE_NOTES: Record<string, string> = {
  TAG_KIT: 'Preço de cada etiqueta NFC: o kit que o artista pede na Certificação cobra este valor × quantidade.',
  OFFPLATFORM_TRANSFER: 'Taxa da transferência de titularidade fora da plataforma, cobrada do vendedor depois das duas assinaturas.',
  APPRAISAL_SIGNED: 'Laudo de opinião de valor pedido pela carteira ou pela obra.',
  COLLECTION_INSURANCE: 'Seguro de acervo pedido pela carteira.',
  PLAN_SUBSCRIPTION: 'Linha contábil da mensalidade; o valor vem do plano, não daqui.',
}

/** The free plan of each audience is what a tenant falls back to: it can never be switched off. */
export const DEFAULT_PLAN_CODES: readonly string[] = PLAN_AUDIENCES.map(defaultPlanFor)
export const isDefaultPlan = (code: string) => DEFAULT_PLAN_CODES.includes(code)

export interface PlanLimitRow { key: UsageKey; label: string; limit: number | null }
export interface AdminPlanRow {
  id: number; code: string; name: string; description: string; audience: PlanAudience; audienceLabel: string
  priceCents: string; active: boolean; isDefault: boolean; activeSubscriptions: number; limits: PlanLimitRow[]
}
export interface AdminServiceRow {
  id: number; code: string; name: string; description: string; priceCents: string; unit: ServiceUnit; unitLabel: string
  active: boolean; orders30d: number; note: string | null
}

export interface PlanInput { name: string; description: string; priceCents: number; active: boolean; limits: Partial<Record<UsageKey, number | null>> }
export interface ServiceInput { name: string; description: string; priceCents: number; unit: ServiceUnit; active: boolean }
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null)
/** Integer cents from a number or a numeric string; "49,90" and "49.90" are read as reais. */
export function parseCents(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= PRICE_MAX_CENTS ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/^R\$\s*/, '')
  if (!s) return null
  if (/^\d+$/.test(s)) return parseCents(Number(s))
  const m = /^(\d{1,7})[.,](\d{1,2})$/.exec(s.replace(/\.(?=\d{3}(\D|$))/g, ''))
  if (!m) return null
  return parseCents(Number(m[1]) * 100 + Number(m[2].padEnd(2, '0')))
}
const limitOf = (v: unknown): number | null | undefined => {
  if (v === null || v === '' || v === 'unlimited') return null
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LIMIT_MAX) return v
  if (typeof v === 'string' && /^\d+$/.test(v.trim()) && Number(v) <= LIMIT_MAX) return Number(v)
  return undefined
}

export function parsePlanInput(raw: unknown): Parsed<PlanInput> {
  const b = (raw ?? {}) as Record<string, unknown>
  const name = text(b.name, NAME_MAX); if (!name) return { ok: false, error: `Nome obrigatório, até ${NAME_MAX} caracteres.` }
  const description = text(b.description ?? '', DESCRIPTION_MAX); if (description === null) return { ok: false, error: `Descrição até ${DESCRIPTION_MAX} caracteres.` }
  const priceCents = parseCents(b.priceCents); if (priceCents === null) return { ok: false, error: 'Preço inválido (em reais, até R$ 1.000.000).' }
  if (typeof b.active !== 'boolean') return { ok: false, error: 'Informe se o plano está ativo.' }
  const limits: Partial<Record<UsageKey, number | null>> = {}
  const src = (b.limits ?? {}) as Record<string, unknown>
  for (const key of Object.keys(src)) {
    if (!(USAGE_KEYS as readonly string[]).includes(key)) return { ok: false, error: `Limite desconhecido: ${key}.` }
    const n = limitOf(src[key]); if (n === undefined) return { ok: false, error: `Limite de ${USAGE_LABELS[key as UsageKey]} inválido (inteiro até ${LIMIT_MAX}, ou vazio = ilimitado).` }
    limits[key as UsageKey] = n
  }
  return { ok: true, value: { name, description, priceCents, active: b.active, limits } }
}

export function parseServiceInput(raw: unknown): Parsed<ServiceInput> {
  const b = (raw ?? {}) as Record<string, unknown>
  const name = text(b.name, NAME_MAX); if (!name) return { ok: false, error: `Nome obrigatório, até ${NAME_MAX} caracteres.` }
  const description = text(b.description ?? '', DESCRIPTION_MAX); if (description === null) return { ok: false, error: `Descrição até ${DESCRIPTION_MAX} caracteres.` }
  const priceCents = parseCents(b.priceCents); if (priceCents === null) return { ok: false, error: 'Preço inválido (em reais, até R$ 1.000.000).' }
  if (!(SERVICE_UNITS as readonly string[]).includes(String(b.unit))) return { ok: false, error: 'Unidade inválida.' }
  if (typeof b.active !== 'boolean') return { ok: false, error: 'Informe se o serviço está ativo.' }
  const unit = b.unit as ServiceUnit
  if (unit !== 'QUOTE' && priceCents === 0) return { ok: false, error: 'Serviço com preço zero só sob orçamento (o pedido recusa a cobrança de R$ 0).' }
  return { ok: true, value: { name, description, priceCents, unit, active: b.active } }
}

/** Switching a plan off: never the fallback plan of an audience. */
export function deactivationBlock(code: string): string | null {
  return isDefaultPlan(code) ? 'Este é o plano padrão do público: contas sem assinatura caem nele, então não pode ser desligado.' : null
}

/** The keys whose value changed, for the audit row and the toast. */
export function changedKeys<T extends Record<string, unknown>>(before: T, after: T): (keyof T)[] {
  return (Object.keys(after) as (keyof T)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
}

/** Reais for the input: "49,90". */
export function centsToInput(cents: bigint | number | string): string {
  const n = Number(cents)
  return `${Math.floor(n / 100)},${String(n % 100).padStart(2, '0')}`
}
