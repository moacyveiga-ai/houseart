// PURE helpers of the App Galeria screens (mirror of the web cores
// `components/gallery/inventory-core.ts` and `listing-manager-core.ts`, plus
// the offer and deal derivations of the prototype `HouseArt App Galeria`).
import { colors, theme } from '@/theme'
import type { ArtworkStatus, DealPhase, DealView, InventoryItem, OfferRow, PanelAction, PanelKpi } from '@/api/gallery'
import { brl } from '@/ui/format'

// ── Acervo ────────────────────────────────────────────────────────────────
export const INVENTORY_CHIPS: { key: string; name: string; statuses: readonly ArtworkStatus[] | null }[] = [
  { key: 'all', name: 'Todas', statuses: null },
  { key: 'listed', name: 'À venda', statuses: ['LISTED'] },
  { key: 'reserved', name: 'Reservadas', statuses: ['IN_DEAL'] },
  { key: 'sold', name: 'Vendidas', statuses: ['SOLD'] },
  { key: 'authenticated', name: 'Autenticadas', statuses: ['AUTHENTICATED'] },
  { key: 'certifying', name: 'Em certificação', statuses: ['IN_CERTIFICATION'] },
  { key: 'drafts', name: 'Rascunhos', statuses: ['DRAFT'] },
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Title, artist or certificate id contain the query (accents and case ignored). */
export function matchesQuery(a: Pick<InventoryItem, 'title' | 'artistName' | 'publicId'>, q: string): boolean {
  const needle = fold(q.trim())
  if (!needle) return true
  return fold(`${a.title} ${a.artistName} ${a.publicId ?? ''}`).includes(needle)
}

export function filterInventory(items: InventoryItem[], chip: string, q: string): InventoryItem[] {
  const c = INVENTORY_CHIPS.find((x) => x.key === chip) ?? INVENTORY_CHIPS[0]!
  return items.filter((a) => (!c.statuses || c.statuses.includes(a.status)) && matchesQuery(a, q))
}

const STATUS_LABEL: Record<ArtworkStatus, string> = { DRAFT: 'Rascunho', IN_CERTIFICATION: 'Em certificação', AUTHENTICATED: 'Autenticada', LISTED: 'À venda', IN_DEAL: 'Em negociação', SOLD: 'Vendida', ARCHIVED: 'Arquivada', STOLEN: 'Roubada', DISPUTED: 'Em disputa' }

/** The status pill of the row (prototype `stOf`): label and background token. */
export function rowStatus(a: Pick<InventoryItem, 'status' | 'listing'>): { label: string; bg: string } {
  if (a.status === 'LISTED') return a.listing?.paused ? { label: 'Pausada', bg: colors.paper200 } : { label: 'À venda', bg: colors.verified100 }
  if (a.status === 'IN_DEAL') return { label: 'Reservada', bg: colors.sand100 }
  if (a.status === 'IN_CERTIFICATION') return { label: 'Em certificação', bg: colors.pending100 }
  if (a.status === 'STOLEN' || a.status === 'DISPUTED') return { label: STATUS_LABEL[a.status], bg: colors.alert100 }
  return { label: STATUS_LABEL[a.status], bg: colors.paper200 }
}

export function rowPrice(a: Pick<InventoryItem, 'saleMode' | 'listPriceCents'>): string {
  if (a.saleMode === 'ON_REQUEST') return 'Sob consulta'
  return a.listPriceCents === null ? '—' : brl(a.listPriceCents)
}

/** The third line of the row: engagement for listed works, the next step for the others. */
export function rowStats(a: Pick<InventoryItem, 'status' | 'listing' | 'deal'>): string {
  switch (a.status) {
    case 'LISTED': {
      const l = a.listing
      if (!l) return 'Sem visualizações ainda'
      const saves = typeof l.saves === 'number' ? ` · ${l.saves} ${l.saves === 1 ? 'salvo' : 'salvos'}` : ''
      const offers = l.openOffers ? ` · ${l.openOffers} ${l.openOffers === 1 ? 'oferta' : 'ofertas'}` : ''
      return `${l.views7d.toLocaleString('pt-BR')} views · 7 dias${saves}${offers}`
    }
    // same reading as the web Acervo: before the escrow is paid the work is only reserved
    case 'IN_DEAL': return a.deal ? (a.deal.phase === 'OFFER_ACCEPTED' ? `Reservada para ${a.deal.buyerName} · aguardando pagamento` : `Vendida para ${a.deal.buyerName} · ${inventoryDealStep(a.deal)}`) : 'Negócio em andamento'
    case 'IN_CERTIFICATION': return 'Aguardando assinatura da artista'
    case 'AUTHENTICATED': return 'Liste no marketplace para vender'
    case 'DRAFT': return 'Peça a certificação para anunciar'
    case 'SOLD': return a.deal ? `Vendida para ${a.deal.buyerName}` : 'Vendida'
    default: return STATUS_LABEL[a.status]
  }
}

export const emptyInventoryText = (q: string): string => (q.trim() ? `Nenhuma obra para “${q.trim()}”.` : 'Nenhuma obra neste filtro.')

// ── Gestão do anúncio ─────────────────────────────────────────────────────
/** Digits of what was typed → integer reais (0 when empty). */
export const priceReais = (raw: string): number => parseInt(String(raw ?? '').replace(/\D/g, ''), 10) || 0
/** The mask of the input: "38000" → "38.000"; empty when zero. */
export function priceMask(raw: string | number): string {
  const n = typeof raw === 'number' ? Math.max(0, Math.floor(raw)) : priceReais(raw)
  return n ? n.toLocaleString('pt-BR') : ''
}
/** Cents of the masked input (whole reais only). */
export const priceCents = (masked: string): number => priceReais(masked) * 100
/** Salvar lights up only when the typed price is positive and differs from the current one. */
export function priceChanged(masked: string, currentCents: string): boolean {
  const typed = priceCents(masked)
  return typed > 0 && typed !== Number(currentCents)
}
export const priceSavedMessage = (nextCents: number, previousCents: number): string => (nextCents < previousCents ? 'Preço reduzido' : 'Preço atualizado')

export function acceptsOffersSub(on: boolean, rules: { refuseBelowBps: number; responseHours: number } | null): string {
  if (!on) return 'Só compra direta'
  if (!rules) return 'Ofertas pelas regras da galeria'
  return `Regras: recusa abaixo de ${Math.round(rules.refuseBelowBps / 100)}% · prazo ${rules.responseHours} h`
}
export const pausedSub = (paused: boolean): string => (paused ? 'Fora do marketplace · curtidas, salvos e ofertas mantidos' : 'Some do marketplace sem perder curtidas nem ofertas')
export const pauseToggledMessage = (nowPaused: boolean): string => (nowPaused ? 'Anúncio pausado' : 'Anúncio de volta ao marketplace')

/** The four stats of the block; saves and likes come from the reactions (an older server without them: "—"). */
export function listingStats(s: { views7d: number; openOffers: number; saves?: number; likes?: number }): { value: string; label: string }[] {
  const n = (v: number | undefined) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : '—')
  return [
    { value: s.views7d.toLocaleString('pt-BR'), label: 'views · 7 dias' },
    { value: n(s.saves), label: 'salvos' },
    { value: n(s.likes), label: 'curtidas' },
    { value: String(s.openOffers), label: s.openOffers === 1 ? 'oferta' : 'ofertas' },
  ]
}

// ── Ofertas ───────────────────────────────────────────────────────────────
/** "92% do preço" and its colour (≥90 verified · ≥75 ink · below alert), null without a list price. */
export function offerPct(o: Pick<OfferRow, 'currentCents' | 'listPriceCents'>): { text: string; color: string } | null {
  if (!o.listPriceCents || Number(o.listPriceCents) <= 0) return null
  const pct = Math.round((Number(o.currentCents) / Number(o.listPriceCents)) * 100)
  return { text: `${pct}% do preço`, color: pct >= 90 ? theme.success : pct >= 75 ? theme.fg : theme.error }
}

/** Open offers first (the prototype's `ordem`), then by date. */
export function sortOffers(rows: OfferRow[]): OfferRow[] {
  return [...rows].sort((a, b) => Number(b.open) - Number(a.open) || b.createdAt.localeCompare(a.createdAt))
}

/** The ball is with the seller when the offer is open and the last round is not the seller's counter. */
export function sellerCanAnswer(o: Pick<OfferRow, 'open' | 'status' | 'rounds'>): boolean {
  if (!o.open) return false
  const last = o.rounds[o.rounds.length - 1]
  return !(o.status === 'NEGOTIATING' && last && last.author !== 'BUYER')
}

/** The resolved pill of a card (prototype `recebidas.st`). */
export function offerResolved(o: Pick<OfferRow, 'status' | 'statusLabel' | 'buyer'>): { label: string; bg: string } {
  switch (o.status) {
    case 'ACCEPTED': return { label: 'Aceita · aguardando pagamento do comprador', bg: colors.verified100 }
    case 'IN_DEAL': return { label: 'Paga em garantia · prepare a embalagem', bg: colors.verified100 }
    case 'CONVERTED': return { label: 'Concluída', bg: colors.verified100 }
    case 'NEGOTIATING': return { label: `Contraproposta enviada · aguardando ${o.buyer}`, bg: colors.pending100 }
    case 'REFUSED': return { label: 'Recusada', bg: colors.paper200 }
    default: return { label: o.statusLabel, bg: colors.paper200 }
  }
}

/** The insight line over the list (prototype `ngResumo`). */
export function offersSummary(rows: OfferRow[]): string | null {
  const open = rows.filter((o) => o.open)
  if (!open.length) return null
  const byArtwork = new Map<number, OfferRow[]>()
  for (const o of open) byArtwork.set(o.artworkId, [...(byArtwork.get(o.artworkId) ?? []), o])
  const multi = [...byArtwork.values()].find((l) => l.length > 1)
  if (multi) {
    const best = multi.reduce((m, o) => (Number(o.currentCents) > Number(m.currentCents) ? o : m))
    const pct = offerPct(best)
    return `${multi.length} ofertas disputam ${multi[0]!.artworkTitle}.${pct ? ` A maior é ${pct.text.replace(' do preço', '')} do preço.` : ''}`
  }
  return `${open.length} ${open.length === 1 ? 'oferta aberta' : 'ofertas abertas'}. Responda antes do prazo para não perder o comprador.`
}

/** Other open offers on the same artwork (prototype `outras`). */
export function otherOffersLine(o: OfferRow, rows: OfferRow[]): string | null {
  if (!o.open) return null
  const others = rows.filter((x) => x.artworkId === o.artworkId && x.id !== o.id && x.open)
  if (!others.length) return null
  const max = Math.max(...others.map((x) => Number(x.currentCents)))
  return `${others.length} ${others.length === 1 ? 'outra oferta' : 'outras ofertas'} nesta obra · maior ${brl(max)}`
}

/** The default counter: halfway between the offer and the asked price, rounded to R$ 500 (prototype `r500`). */
export function suggestedCounterReais(o: Pick<OfferRow, 'currentCents' | 'listPriceCents'>): number {
  const cur = Number(o.currentCents) / 100
  const list = o.listPriceCents ? Number(o.listPriceCents) / 100 : cur
  return Math.round((cur + list) / 2 / 500) * 500
}

// ── Vendas ────────────────────────────────────────────────────────────────
export const DEAL_PHASES: readonly DealPhase[] = ['OFFER_ACCEPTED', 'ESCROW', 'DOCUMENTS', 'SHIPPING', 'DELIVERY', 'TRANSFER', 'COMPLETED']
export const phaseIndex = (p: DealPhase): number => DEAL_PHASES.indexOf(p)

/** The six segments of the card: filled up to the phase (green when complete). */
export function dealSegments(d: Pick<DealView, 'phase'>): string[] {
  const i = phaseIndex(d.phase)
  const done = d.phase === 'COMPLETED'
  return Array.from({ length: 6 }, (_, k) => (k <= i ? (done ? theme.success : theme.fg) : theme.border))
}

/** The step of a sale in the Acervo line ("Vendida para X · registrar envio"), as the web's saleAction. */
export function inventoryDealStep(d: { phase: string; sellerSigned?: boolean; exception?: string | null }): string {
  if (d.exception === 'CANCELLED') return 'cancelada'
  if (d.exception === 'DISPUTE') return 'em disputa'
  return dealAction({ phase: d.phase as DealView['phase'], sellerSigned: !!d.sellerSigned, buyerSigned: false }).label.toLowerCase()
}

/** What the card says the seller does now (prototype `acao`), and whether it is on the seller. */
export function dealAction(d: Pick<DealView, 'phase' | 'sellerSigned' | 'buyerSigned'>): { label: string; pending: boolean } {
  switch (d.phase) {
    case 'OFFER_ACCEPTED': return { label: 'Aguardando pagamento', pending: false }
    case 'ESCROW': return d.sellerSigned ? { label: 'Aguardando comprador', pending: false } : { label: 'Assinar termo', pending: true }
    case 'DOCUMENTS': return { label: 'Registrar envio', pending: true }
    case 'SHIPPING': return { label: 'Acompanhar', pending: false }
    case 'DELIVERY': return { label: 'Aguardando comprador', pending: false }
    case 'TRANSFER': return { label: 'Repasse liberado', pending: false }
    default: return { label: 'Concluída', pending: false }
  }
}

/** The title of the current step (the card's "etapa"). */
export function dealStageTitle(d: Pick<DealView, 'phase' | 'steps'>): string {
  if (d.phase === 'COMPLETED') return 'Repasse liberado'
  const on = d.steps.find((s) => s.state === 'on')
  return on?.title ?? d.steps[d.steps.length - 1]?.title ?? ''
}

/** "Venda" / "Revenda" and the platform share the split quotes (12 % primary, 4 % secondary). */
export const marketShare = (market: string): string => (market === 'PRIMARY' ? '12%' : '4%')

// ── Painel ────────────────────────────────────────────────────────────────
export type PanelTarget = { kind: 'tab'; tab: 'sales' | 'artworks' | 'messages' | 'community'; params?: Record<string, string> } | { kind: 'web'; path: string; title: string } | { kind: 'listing'; id: number }

/** The web `href` of a KPI or action → where the app goes. */
export function panelTarget(href: string): PanelTarget {
  if (href.startsWith('/sales/rules')) return { kind: 'tab', tab: 'sales', params: { tab: 'rules' } }
  if (href.startsWith('/sales?tab=deals')) return { kind: 'tab', tab: 'sales', params: { tab: 'deals' } }
  if (href.startsWith('/sales')) return { kind: 'tab', tab: 'sales', params: { tab: 'offers' } }
  if (href.startsWith('/artworks')) return { kind: 'tab', tab: 'artworks' }
  if (href.startsWith('/messages')) return { kind: 'tab', tab: 'messages' }
  if (href.startsWith('/community')) return { kind: 'tab', tab: 'community' }
  return { kind: 'web', path: href, title: href.startsWith('/certification') ? 'Certificação' : 'HouseArt' }
}

export function kpiColors(k: Pick<PanelKpi, 'dark'>): { bg: string; fg: string; sub: string } {
  return k.dark ? { bg: colors.ink900, fg: colors.paper50, sub: colors.ink300 } : { bg: colors.paper100, fg: colors.ink900, sub: colors.ink500 }
}

export function actionTone(a: Pick<PanelAction, 'tone'>): { iconBg: string; tagBg: string } {
  if (a.tone === 'pending') return { iconBg: colors.sand100, tagBg: colors.pending100 }
  if (a.tone === 'alert') return { iconBg: colors.sand100, tagBg: colors.alert100 }
  return { iconBg: colors.paper100, tagBg: colors.paper200 }
}

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Material Symbols name from the API → Material Icons glyph of @expo/vector-icons (`contract` has no glyph: `description`). */
const SYMBOL_TO_ICON: Record<string, string> = { contract: 'description', imagesmode: 'image' }
export const symbolIcon = (name: string): string => SYMBOL_TO_ICON[name] ?? name.replace(/_/g, '-')
