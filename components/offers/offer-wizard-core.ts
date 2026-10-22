// Rules of the web offer wizard (handoff "HouseArt Oferta") — PURE. Numbers
// are integers in cents; the prototype's R$ 100 rounding, the 50 % floor of
// the list price, the shortcuts, the chance band, the validities and the
// review rows live here so the island only renders.
import { GUARANTEE_LABELS, VALIDITY_HOURS, type GuaranteeMethod } from '@/lib/payment-methods/domain'
import { formatBRL } from '@/lib/artworks/domain'

export const STEPS = [
  { key: 'value', name: 'Valor', icon: 'payments' },
  { key: 'identity', name: 'Identidade', icon: 'badge' },
  { key: 'guarantee', name: 'Garantia', icon: 'lock' },
  { key: 'review', name: 'Revisão', icon: 'fact_check' },
] as const
export type StepIndex = 1 | 2 | 3 | 4

/** The lowest offer the prototype allows: 50 % of the list price (a UI limit, nothing to do with the mandate). */
export const MIN_RATIO = 0.5
export const SHORTCUTS = [0.95, 0.9, 0.85, 0.8] as const
export const SLIDER_STEP_CENTS = 50_000

/** The three guarantees the prototype offers (NONE never appears on the screen). */
export const WIZARD_GUARANTEES: readonly GuaranteeMethod[] = ['CARD_HOLD', 'PIX_RESERVE', 'TRANSFER_ON_ACCEPT']
export const guaranteeName = (m: string) => GUARANTEE_LABELS[(m in GUARANTEE_LABELS ? m : 'NONE') as GuaranteeMethod].name

export type SellerKind = 'GALLERY' | 'PRIVATE'
/** "a galeria" / "o vendedor" — the prototype speaks of the gallery; a private seller gets the neutral word. */
export const sellerWord = (kind: SellerKind) => (kind === 'GALLERY' ? 'a galeria' : 'o vendedor')

export const validityOptions = (kind: SellerKind): readonly { hours: (typeof VALIDITY_HOURS)[number]; name: string; sub: string }[] => [
  { hours: 24, name: '24 horas', sub: 'Resposta rápida' },
  { hours: 48, name: '48 horas', sub: 'Recomendado' },
  { hours: 72, name: '72 horas', sub: `Mais tempo para ${sellerWord(kind)}` },
]

/** Rounds to R$ 100 (10 000 cents). */
export const roundTo100 = (cents: number) => Math.round(cents / 10_000) * 10_000
export const minOfferCents = (priceCents: number) => roundTo100(priceCents * MIN_RATIO)
export const shortcutCents = (priceCents: number, factor: number) => roundTo100(priceCents * factor)

/** The prototype's `setValor`: clamp to [50 %, price] after rounding to R$ 100. */
export function clampOffer(cents: number, priceCents: number): number {
  return Math.max(minOfferCents(priceCents), Math.min(priceCents, roundTo100(cents)))
}

/** Typing in the big field: digits are reais; never above the list price (the clamp happens on blur). */
export function typedCents(raw: string, priceCents: number): number {
  const n = parseInt(raw.replace(/\D/g, ''), 10) || 0
  return Math.min(priceCents, n * 100)
}

/** Whole reais with the pt-BR thousands separator, for the big input. */
export const reaisText = (cents: number) => Math.round(cents / 100).toLocaleString('pt-BR')

export type ChanceTone = 'good' | 'fair' | 'low'
export interface Chance { tone: ChanceTone; icon: string; title: string; text: string }
export function chanceOf(offerCents: number, priceCents: number, kind: SellerKind = 'GALLERY'): Chance {
  const pct = priceCents > 0 ? offerCents / priceCents : 0
  const who = kind === 'GALLERY' ? 'esta galeria' : 'este vendedor'
  const Who = kind === 'GALLERY' ? 'A galeria' : 'O vendedor'
  if (pct >= 0.9) return { tone: 'good', icon: 'trending_up', title: 'Boa chance de ser aceita', text: `Ofertas a partir de 90% do preço pedido costumam ser aceitas por ${who}.` }
  if (pct >= 0.8) return { tone: 'fair', icon: 'balance', title: 'Chance moderada', text: `${Who} pode aceitar ou responder com uma contraproposta.` }
  return { tone: 'low', icon: 'trending_down', title: `Abaixo do que ${who} costuma aceitar`, text: 'Ofertas abaixo de 80% raramente são aceitas. Considere subir o valor ou deixar uma mensagem.' }
}

export interface IdentityState { cpfOk: boolean; phoneOk: boolean; emailOk: boolean }
/** Step 2 continues when CPF and phone are confirmed; the e-mail is proven by the account or by the code at the send. */
export const identityComplete = (i: IdentityState) => i.cpfOk && i.phoneOk

export interface WizardChoice { offerCents: number; validityHours: number; message: string; guarantee: GuaranteeMethod; cardLabel: string | null }

export function canAdvance(step: StepIndex, s: { identity: IdentityState; accepted: boolean; guarantee: GuaranteeMethod; hasCard: boolean; loggedIn: boolean }): boolean {
  if (step === 2) return s.loggedIn && identityComplete(s.identity)
  if (step === 3) return s.guarantee !== 'CARD_HOLD' || s.hasCard
  if (step === 4) return s.accepted
  return true
}

/** "Mensagem" shown in the review: the prototype quotes 40 characters. */
export function messagePreview(msg: string): string {
  const t = msg.trim()
  if (!t) return 'Sem mensagem'
  return `“${t.length > 40 ? `${t.slice(0, 40)}…` : t}”`
}

export interface ReviewRow { key: string; value: string; step: StepIndex }
export function reviewRows(c: WizardChoice): ReviewRow[] {
  const guarantee = c.guarantee === 'CARD_HOLD' && c.cardLabel ? `${guaranteeName(c.guarantee)} · ${c.cardLabel}` : guaranteeName(c.guarantee)
  return [
    { key: 'Valor da oferta', value: formatBRL(c.offerCents), step: 1 },
    { key: 'Validade', value: `${c.validityHours} horas`, step: 1 },
    { key: 'Mensagem', value: messagePreview(c.message), step: 1 },
    { key: 'Identidade', value: 'Verificada', step: 2 },
    { key: 'Garantia', value: guarantee, step: 3 },
  ]
}

/** The aside total: offer + shipping + insurance (the HouseArt fee is free for buyers). */
export const totalIfAccepted = (offerCents: number, shippingCents: number, insuranceCents: number) => offerCents + shippingCents + insuranceCents

export const CEP_RE = /^\d{5}-?\d{3}$/
export const formatCepInput = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }

/** The draft the island keeps while the viewer goes to /login and comes back (sessionStorage, per artwork). */
export const draftKey = (publicId: string) => `offer-draft:${publicId}`
