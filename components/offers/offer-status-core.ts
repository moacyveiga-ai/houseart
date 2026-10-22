// The "Enviada" step of the handoff (HouseArt Oferta): which status card, which
// timeline, which final actions the buyer sees for a BuyerOffer — PURE. The
// prototype's six responses (analise · aceita · contra · contra_aceita ·
// recusada · expirada) are derived from status + canReply + the rounds.
import { formatBRL } from '@/lib/artworks/domain'

export type Response = 'analise' | 'aguardando' | 'aceita' | 'contra' | 'contra_aceita' | 'recusada' | 'expirada' | 'retirada' | 'cancelada'

export interface StatusOffer {
  status: string; canReply: boolean; canRetract: boolean; validityHours: number
  offeredCents: number; currentCents: number; listPriceCents: number | null
  rounds: { number: number; author: string; amountCents: number; message: string | null; at: string }[]
  createdAt: string; expiresAt: string; counterCents: number | null; counterMessage: string | null
  guaranteeMethod: string; shippingCents: number; insuranceCents: number
}

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
export interface StatusCard { icon: string; tone: Tone; title: string; text: string }

/** `seller` is how the seller is named ("a Galeria Ladeira" / "o vendedor"). */
export function statusCard(o: StatusOffer, r: Response, seller: string): StatusCard {
  const Seller = seller.charAt(0).toUpperCase() + seller.slice(1)
  const guaranteeNote = o.guaranteeMethod === 'CARD_HOLD' ? 'A reserva no seu cartão já foi desfeita. ' : o.guaranteeMethod === 'PIX_RESERVE' ? 'O Pix reservado já foi devolvido. ' : ''
  switch (r) {
    case 'aceita': return { icon: 'check_circle', tone: 'ok', title: 'Oferta aceita!', text: `A obra é sua por ${formatBRL(o.currentCents)}. O pagamento vai para a garantia e ${seller} já pode preparar o envio.` }
    case 'contra_aceita': return { icon: 'check_circle', tone: 'ok', title: 'Negócio fechado', text: `Você aceitou a contraproposta de ${formatBRL(o.currentCents)}. O pagamento vai para a garantia e ${seller} já pode preparar o envio.` }
    case 'contra': return { icon: 'swap_horiz', tone: 'sand', title: 'Você recebeu uma contraproposta', text: `${Seller} respondeu com um novo valor. Você tem até ${expiresText(o.expiresAt)} para decidir.` }
    case 'aguardando': return { icon: 'schedule_send', tone: 'neutral', title: 'Nova oferta enviada', text: `${Seller} recebeu sua nova oferta de ${formatBRL(o.currentCents)} e tem até ${expiresText(o.expiresAt)} para responder. Avisaremos por e-mail.` }
    case 'recusada': return { icon: 'cancel', tone: 'alert', title: 'Oferta não aceita', text: `${guaranteeNote}Você pode fazer uma nova oferta ou comprar ao preço pedido.` }
    case 'expirada': return { icon: 'timer_off', tone: 'muted', title: 'Oferta expirada', text: `${Seller} não respondeu dentro do prazo. Nenhum valor foi cobrado.` }
    case 'retirada': return { icon: 'undo', tone: 'muted', title: 'Oferta retirada', text: `Você retirou esta oferta. ${guaranteeNote}Nenhum valor foi cobrado.` }
    case 'cancelada': return { icon: 'block', tone: 'muted', title: 'Oferta cancelada', text: 'Esta oferta foi cancelada. Nenhum valor foi cobrado.' }
    default: return { icon: 'schedule_send', tone: 'neutral', title: 'Oferta enviada', text: `${Seller} tem até ${o.validityHours} horas para responder. Avisaremos por e-mail e no app.` }
  }
}

const TZ = 'America/Bahia'
export function timeText(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: TZ })
  const hm = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  if (day(d) === day(now)) return `hoje ${hm}`
  const y = new Date(now.getTime() - 86_400_000)
  if (day(d) === day(y)) return `ontem ${hm}`
  return `${d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })} ${hm}`
}
export const expiresText = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export interface TimelineItem { name: string; sub: string; when: string; done: boolean }

export interface SellerName { name: string; kind: 'GALLERY' | 'PRIVATE' }
/** "a Galeria Ladeira" / "o vendedor" — the subject of the sentences above. */
export const sellerPhrase = (s: SellerName) => (s.kind === 'GALLERY' ? `a ${s.name}` : 'o vendedor')

export function timelineOf(o: StatusOffer, r: Response, seller: SellerName, now = new Date()): TimelineItem[] {
  const closed = r === 'aceita' || r === 'contra_aceita'
  const sellerRounds = o.rounds.filter((x) => x.author !== 'BUYER')
  const lastSeller = sellerRounds[sellerRounds.length - 1]
  const answered = r !== 'analise' && r !== 'aguardando'
  const responseSub: Record<Response, string> = {
    analise: 'Aguardando', aguardando: 'Aguardando resposta à sua nova oferta', aceita: 'Aceita', contra: `Contraproposta de ${formatBRL(o.counterCents ?? o.currentCents)}`,
    contra_aceita: 'Contraproposta aceita', recusada: 'Recusada', expirada: 'Expirada', retirada: 'Oferta retirada por você', cancelada: 'Cancelada',
  }
  const responseAt = r === 'expirada' ? o.expiresAt : lastSeller?.at ?? (answered ? o.rounds[o.rounds.length - 1]?.at ?? o.createdAt : null)
  return [
    { name: 'Oferta enviada', sub: `${formatBRL(o.offeredCents)} · validade ${o.validityHours}h`, when: timeText(o.createdAt, now), done: true },
    { name: seller.kind === 'GALLERY' ? 'Galeria analisando' : 'Vendedor analisando', sub: seller.kind === 'GALLERY' ? `${seller.name} foi notificada` : 'O vendedor foi notificado', when: answered ? timeText(lastSeller?.at ?? o.createdAt, now) : 'agora', done: answered },
    { name: 'Resposta', sub: responseSub[r], when: responseAt && answered ? timeText(responseAt, now) : '', done: answered },
    { name: 'Pagamento em garantia e envio', sub: closed ? 'Acompanhe a compra: pagamento, envio e confirmação pela etiqueta' : 'Após o aceite', when: '', done: closed },
  ]
}

export interface FinalAction { name: string; href: string | null; kind: 'ink' | 'outline'; action?: 'retract' }
export function finalActions(o: StatusOffer, r: Response, artworkPublicId: string | null): FinalAction[] {
  const closed = r === 'aceita' || r === 'contra_aceita'
  if (closed) return [{ name: 'Acompanhar a compra', href: '/purchases', kind: 'ink' }, { name: 'Ver outras obras', href: '/e/marketplace', kind: 'outline' }]
  if (r === 'analise' || r === 'aguardando' || r === 'contra') {
    const out: FinalAction[] = [{ name: 'Ver minhas compras', href: '/purchases', kind: 'ink' }]
    if (o.canRetract) out.push({ name: 'Cancelar oferta', href: null, kind: 'outline', action: 'retract' })
    return out
  }
  const out: FinalAction[] = []
  if (artworkPublicId) out.push({ name: 'Fazer nova oferta', href: `/e/artwork/${artworkPublicId}/offer`, kind: 'ink' })
  if (artworkPublicId && o.listPriceCents) out.push({ name: `Comprar por ${formatBRL(o.listPriceCents)}`, href: `/e/artwork/${artworkPublicId}/buy`, kind: 'outline' })
  return out
}
