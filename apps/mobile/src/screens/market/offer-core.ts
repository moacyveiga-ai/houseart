// Fazer oferta (handoff "HouseArt App Colecionador" › sheet `oferta`) and the
// web five-step wizard — PURE. Cents as JS numbers. The prototype rounds to
// R$ 500 and warns under 70 % of the asking price; the server (the seller's
// rules) is the authority on what is refused.
import type { GuaranteeMethod } from '@/api/types'
import { brl } from '@/ui/format'

export const STEPS = [
  { key: 'value', name: 'Valor' },
  { key: 'terms', name: 'Condições' },
  { key: 'identity', name: 'Identidade' },
  { key: 'guarantee', name: 'Garantia' },
  { key: 'review', name: 'Revisão' },
] as const
export type StepIndex = 1 | 2 | 3 | 4 | 5

/** `r500` of the prototype, in cents. */
export const round500 = (cents: number) => Math.round(cents / 50_000) * 50_000
/** The three shortcuts of the prototype: −5 % · −10 % · −15 %. */
export const SUGGESTIONS = [5, 10, 15] as const
export const suggestionCents = (priceCents: number, pct: number) => round500(priceCents * (1 - pct / 100))
export const suggestionLabel = (priceCents: number, pct: number) => `−${pct}% · ${brl(suggestionCents(priceCents, pct))}`
/** The prototype opens the sheet at 90 % of the asking price. */
export const defaultOfferCents = (priceCents: number) => round500(priceCents * 0.9)

/** Under this share the prototype shows the warning line; the seller's rules decide the refusal. */
export const WARN_RATIO = 0.7
/** Under half the asking price nothing is sent (the web wizard's limit). */
export const MIN_RATIO = 0.5
export const belowWarning = (cents: number, priceCents: number) => cents > 0 && cents < priceCents * WARN_RATIO
export const tooLow = (cents: number, priceCents: number) => cents < priceCents * MIN_RATIO
export const WARNING_LINE = 'Ofertas abaixo de 70% do preço pedido são recusadas automaticamente.'

/** Typing reais with the pt-BR separators → cents; never above the asking price. */
export function typedCents(raw: string, priceCents: number): number {
  const n = parseInt(raw.replace(/\D/g, ''), 10) || 0
  return Math.min(priceCents, n * 100)
}
export const reaisText = (cents: number) => (cents ? Math.round(cents / 100).toLocaleString('pt-BR') : '')

export const VALIDITIES: readonly { hours: 24 | 48 | 72; name: string }[] = [{ hours: 24, name: '24 h' }, { hours: 48, name: '48 h' }, { hours: 72, name: '72 h' }]

export const GUARANTEES: readonly { key: GuaranteeMethod; name: string; sub: string; icon: 'credit-card' | 'pix' | 'account-balance' }[] = [
  { key: 'CARD_HOLD', name: 'Pré-autorização no cartão', sub: 'O valor é reservado, não cobrado', icon: 'credit-card' },
  { key: 'PIX_RESERVE', name: 'Pix com devolução automática', sub: 'Devolvido em até 1 minuto se a oferta não for aceita', icon: 'pix' },
  { key: 'TRANSFER_ON_ACCEPT', name: 'Transferência na aceitação', sub: 'Você paga só depois do aceite, em até 24 horas', icon: 'account-balance' },
]
export const guaranteeName = (m: string) => GUARANTEES.find((g) => g.key === m)?.name ?? 'Sem garantia'

export type SellerKind = 'GALLERY' | 'PRIVATE'
export const sellerWord = (kind: SellerKind) => (kind === 'GALLERY' ? 'a galeria' : 'o vendedor')

export interface IdentityState { cpfOk: boolean; phoneOk: boolean }
export const identityComplete = (i: IdentityState) => i.cpfOk && i.phoneOk

export function canAdvance(step: StepIndex, s: { offerCents: number; priceCents: number; identity: IdentityState; guarantee: GuaranteeMethod; hasCard: boolean; accepted: boolean }): boolean {
  if (step === 1) return s.offerCents > 0 && !tooLow(s.offerCents, s.priceCents)
  if (step === 3) return identityComplete(s.identity)
  if (step === 4) return s.guarantee !== 'CARD_HOLD' || s.hasCard
  if (step === 5) return s.accepted
  return true
}

/** The CTA of the prototype: "Enviar oferta de R$ X" / "Digite um valor". */
export const ctaOf = (step: StepIndex, offerCents: number) => (step === 5 ? (offerCents ? `Enviar oferta de ${brl(offerCents)}` : 'Digite um valor') : 'Continuar')

export function messagePreview(msg: string): string {
  const t = msg.trim()
  if (!t) return 'Sem mensagem'
  return `“${t.length > 40 ? `${t.slice(0, 40)}…` : t}”`
}

export interface ReviewRow { key: string; value: string; step: StepIndex }
export function reviewRows(c: { offerCents: number; validityHours: number; message: string; guarantee: GuaranteeMethod; cardLabel: string | null; cepLabel: string | null }): ReviewRow[] {
  const guarantee = c.guarantee === 'CARD_HOLD' && c.cardLabel ? `${guaranteeName(c.guarantee)} · ${c.cardLabel}` : guaranteeName(c.guarantee)
  return [
    { key: 'Valor da oferta', value: brl(c.offerCents), step: 1 },
    { key: 'Validade', value: `${c.validityHours} horas`, step: 2 },
    { key: 'Mensagem', value: messagePreview(c.message), step: 2 },
    { key: 'Identidade', value: 'Verificada', step: 3 },
    { key: 'Garantia', value: guarantee, step: 4 },
    { key: 'Entrega', value: c.cepLabel ?? 'Sem CEP · a combinar', step: 4 },
  ]
}

export const formatCepInput = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }
export const formatCpfInput = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2') }
export const formatPhoneInput = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 11); if (d.length < 3) return d; if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` }

// ── the "Sua oferta" / "Contraproposta recebida" screen (port of components/offers/offer-status-core.ts) ──
export type Response = 'analise' | 'aguardando' | 'aceita' | 'contra' | 'contra_aceita' | 'recusada' | 'expirada' | 'retirada' | 'cancelada'
export interface StatusOffer { status: string; canReply: boolean; canRetract: boolean; validityHours: number; offeredCents: number; currentCents: number; listPriceCents: number | null; rounds: { number: number; author: string; amountCents: number; message: string | null; at: string }[]; createdAt: string; expiresAt: string; counterCents: number | null; counterMessage: string | null; guaranteeMethod: string }

const CLOSED = ['ACCEPTED', 'IN_DEAL', 'CONVERTED']
export function responseOf(o: StatusOffer): Response {
  if (CLOSED.includes(o.status)) return o.rounds.some((r) => r.author !== 'BUYER') ? 'contra_aceita' : 'aceita'
  if (o.status === 'NEGOTIATING') return o.canReply ? 'contra' : 'aguardando'
  if (o.status === 'REFUSED') return 'recusada'
  if (o.status === 'EXPIRED') return 'expirada'
  if (o.status === 'RETRACTED') return 'retirada'
  if (o.status === 'CANCELLED') return 'cancelada'
  return 'analise'
}

export type Tone = 'neutral' | 'ok' | 'sand' | 'alert' | 'muted'
export interface StatusCard { icon: 'schedule-send' | 'check-circle' | 'swap-horiz' | 'cancel' | 'timer-off' | 'undo' | 'block'; tone: Tone; title: string; text: string }

const TZ = 'America/Bahia'
export const expiresText = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** The six responses of the prototype `ST` plus the web's; `seller` is "a Galeria X" / "o vendedor". */
export function statusCard(o: StatusOffer, r: Response, seller: string, sellerShort: string): StatusCard {
  const Seller = seller.charAt(0).toUpperCase() + seller.slice(1)
  const note = o.guaranteeMethod === 'CARD_HOLD' ? 'A reserva no seu cartão já foi desfeita. ' : o.guaranteeMethod === 'PIX_RESERVE' ? 'O Pix reservado já foi devolvido. ' : ''
  switch (r) {
    case 'aceita': return { icon: 'check-circle', tone: 'ok', title: 'Oferta aceita', text: `A obra é sua por ${brl(o.currentCents)}. O valor fica em garantia até a entrega e ${seller} já pode preparar o envio.` }
    case 'contra_aceita': return { icon: 'check-circle', tone: 'ok', title: 'Negócio fechado', text: `Você aceitou a contraproposta de ${brl(o.currentCents)}. O valor fica em garantia até a entrega e ${seller} já pode preparar o envio.` }
    case 'contra': return { icon: 'swap-horiz', tone: 'sand', title: `Contraproposta de ${brl(o.counterCents ?? o.currentCents)}`, text: `${sellerShort} respondeu à sua oferta. Aceite para seguir ao pagamento, ou converse antes. Você tem até ${expiresText(o.expiresAt)} para decidir.` }
    case 'aguardando': return { icon: 'schedule-send', tone: 'neutral', title: 'Nova oferta enviada', text: `${Seller} recebeu sua nova oferta de ${brl(o.currentCents)} e tem até ${expiresText(o.expiresAt)} para responder.` }
    case 'recusada': return { icon: 'cancel', tone: 'alert', title: 'Oferta recusada', text: `${note}Você pode fazer uma nova oferta ou comprar pelo preço pedido.` }
    case 'expirada': return { icon: 'timer-off', tone: 'muted', title: 'Oferta expirada', text: `${Seller} não respondeu dentro do prazo. Nada foi cobrado.` }
    case 'retirada': return { icon: 'undo', tone: 'muted', title: 'Oferta retirada', text: `Você retirou esta oferta. ${note}Nada foi cobrado.` }
    case 'cancelada': return { icon: 'block', tone: 'muted', title: 'Oferta cancelada', text: 'Esta oferta foi cancelada. Nada foi cobrado.' }
    default: return { icon: 'schedule-send', tone: 'neutral', title: 'Oferta enviada', text: `O vendedor tem ${o.validityHours} h para aceitar, recusar ou fazer contraproposta. Nada foi cobrado.` }
  }
}

export function timeText(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: TZ })
  const hm = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  if (day(d) === day(now)) return `hoje ${hm}`
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return `ontem ${hm}`
  return `${d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })} ${hm}`
}

export interface TimelineItem { name: string; sub: string; when: string; done: boolean }
export function timelineOf(o: StatusOffer, r: Response, sellerKind: SellerKind, now = new Date()): TimelineItem[] {
  const closed = r === 'aceita' || r === 'contra_aceita'
  const sellerRounds = o.rounds.filter((x) => x.author !== 'BUYER')
  const lastSeller = sellerRounds[sellerRounds.length - 1]
  const answered = r !== 'analise' && r !== 'aguardando'
  const responseSub: Record<Response, string> = { analise: 'Aguardando', aguardando: 'Aguardando resposta à sua nova oferta', aceita: 'Aceita', contra: `Contraproposta de ${brl(o.counterCents ?? o.currentCents)}`, contra_aceita: 'Contraproposta aceita', recusada: 'Recusada', expirada: 'Expirada', retirada: 'Oferta retirada por você', cancelada: 'Cancelada' }
  const responseAt = r === 'expirada' ? o.expiresAt : lastSeller?.at ?? (answered ? o.rounds[o.rounds.length - 1]?.at ?? o.createdAt : null)
  return [
    { name: 'Oferta enviada', sub: `${brl(o.offeredCents)} · validade ${o.validityHours} h`, when: timeText(o.createdAt, now), done: true },
    { name: sellerKind === 'GALLERY' ? 'Galeria analisando' : 'Vendedor analisando', sub: sellerKind === 'GALLERY' ? 'A galeria foi notificada' : 'O vendedor foi notificado', when: answered ? timeText(lastSeller?.at ?? o.createdAt, now) : 'agora', done: answered },
    { name: 'Resposta', sub: responseSub[r], when: responseAt && answered ? timeText(responseAt, now) : '', done: answered },
    { name: 'Pagamento em garantia e envio', sub: closed ? 'Acompanhe a compra: pagamento, envio e confirmação pela etiqueta' : 'Após o aceite', when: '', done: closed },
  ]
}

/** The rows of the prototype: Preço pedido · Sua oferta (· Contraproposta). */
export function amountRows(o: StatusOffer, r: Response): { k: string; v: string; bold: boolean }[] {
  const buyer = [...o.rounds].reverse().find((x) => x.author === 'BUYER')?.amountCents ?? o.offeredCents
  return [
    ...(o.listPriceCents ? [{ k: 'Preço pedido', v: brl(o.listPriceCents), bold: false }] : []),
    { k: 'Sua oferta', v: brl(buyer), bold: true },
    ...(r === 'contra' && o.counterCents !== null ? [{ k: 'Contraproposta', v: brl(o.counterCents), bold: true }] : []),
  ]
}

/** A new amount against the counter: above the buyer's own last number, under the counter, never above the asking price. */
export function counterValid(cents: number, o: StatusOffer): boolean {
  const mine = [...o.rounds].reverse().find((x) => x.author === 'BUYER')?.amountCents ?? o.offeredCents
  return cents > mine && cents < (o.counterCents ?? Infinity) && (o.listPriceCents === null || cents <= o.listPriceCents)
}
