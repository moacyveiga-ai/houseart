// Artwork domain — allowlists and labels (the chips of the design). Pure.
export const ARTWORK_STATUSES = ['DRAFT', 'IN_CERTIFICATION', 'AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD', 'ARCHIVED', 'STOLEN', 'DISPUTED'] as const
export type ArtworkStatus = (typeof ARTWORK_STATUSES)[number]

export const ARTWORK_STATUS_LABELS: Record<ArtworkStatus, string> = {
  DRAFT: 'Rascunho',
  IN_CERTIFICATION: 'Em certificação',
  AUTHENTICATED: 'Autenticada',
  LISTED: 'À venda',
  IN_DEAL: 'Em negociação',
  SOLD: 'Vendida',
  ARCHIVED: 'Arquivada',
  STOLEN: 'Roubada',
  DISPUTED: 'Contestada',
}

export const ARTWORK_STATUS_ICONS: Record<ArtworkStatus, string> = {
  DRAFT: 'edit_note', IN_CERTIFICATION: 'pending', AUTHENTICATED: 'verified', LISTED: 'storefront', IN_DEAL: 'handshake',
  SOLD: 'sell', ARCHIVED: 'inventory_2', STOLEN: 'report', DISPUTED: 'gavel',
}

/**
 * The technique of an artwork — the seven of the handoff (§5: Pintura, Escultura, Fotografia, Literatura,
 * Gravura, Desenho, Técnica mista), in that order. `technique` stays the free detail ("Óleo sobre linho").
 * The categories of before (WORK_ON_PAPER, DIGITAL, OTHER) were moved by migration
 * 20261026300000_artwork_technique_taxonomy; their labels stay readable for frozen certificate payloads.
 */
export const ARTWORK_CATEGORIES = ['PAINTING', 'SCULPTURE', 'PHOTOGRAPHY', 'LITERATURE', 'PRINT', 'DRAWING', 'MIXED_MEDIA'] as const
export type ArtworkCategory = (typeof ARTWORK_CATEGORIES)[number]
export const ARTWORK_CATEGORY_LABELS: Record<ArtworkCategory, string> = {
  PAINTING: 'Pintura', SCULPTURE: 'Escultura', PHOTOGRAPHY: 'Fotografia', LITERATURE: 'Literatura', PRINT: 'Gravura', DRAWING: 'Desenho', MIXED_MEDIA: 'Técnica mista',
}
const LEGACY_CATEGORY_LABELS: Record<string, string> = { WORK_ON_PAPER: 'Obra sobre papel', DIGITAL: 'Digital', OTHER: 'Outro' }
/** The label of any category ever stored (the seven, or one of before on a frozen certificate). */
export function categoryLabel(c: string | null | undefined): string {
  if (!c) return ''
  return ARTWORK_CATEGORY_LABELS[c as ArtworkCategory] ?? LEGACY_CATEGORY_LABELS[c] ?? c
}
/** The four techniques with a brand language mark (`--ha-brand-*`, components/layout/HouseArtLogo LanguageMark). */
export const CATEGORY_LANGUAGE: Partial<Record<string, 'pintura' | 'escultura' | 'fotografia' | 'literatura'>> = {
  PAINTING: 'pintura', SCULPTURE: 'escultura', PHOTOGRAPHY: 'fotografia', LITERATURE: 'literatura',
}

export const CONDITION_GRADES = ['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_RESTORATION'] as const
export const CONDITION_GRADE_LABELS: Record<(typeof CONDITION_GRADES)[number], string> = {
  EXCELLENT: 'Excelente', GOOD: 'Bom', FAIR: 'Regular', NEEDS_RESTORATION: 'Precisa de restauro',
}

export const CONDITION_REGIONS = ['TOP_LEFT', 'TOP_RIGHT', 'CENTER', 'BOTTOM_LEFT', 'EDGES_FRAME'] as const
export const CONDITION_REGION_LABELS: Record<(typeof CONDITION_REGIONS)[number], string> = {
  TOP_LEFT: 'Superior esquerda', TOP_RIGHT: 'Superior direita', CENTER: 'Centro', BOTTOM_LEFT: 'Inferior esquerda', EDGES_FRAME: 'Bordas e chassi',
}
export const CONDITION_STATES = ['INTACT', 'ATTENTION', 'DAMAGED'] as const
export const CONDITION_STATE_LABELS: Record<(typeof CONDITION_STATES)[number], string> = { INTACT: 'Íntegra', ATTENTION: 'Atenção', DAMAGED: 'Danificada' }

/** How a collector came to own the artwork they register (App Colecionador › Cadastrar obra). */
export const ACQUISITION_KINDS = ['BOUGHT_OUTSIDE', 'FROM_ARTIST', 'INHERITED'] as const
export type AcquisitionKind = (typeof ACQUISITION_KINDS)[number]
export const ACQUISITION_KIND_CARDS: { key: AcquisitionKind; name: string; description: string; icon: string }[] = [
  { key: 'BOUGHT_OUTSIDE', name: 'Comprei fora da HouseArt', description: 'Em galeria, feira ou direto de outra pessoa', icon: 'shopping_bag' },
  { key: 'FROM_ARTIST', name: 'Recebi do próprio artista', description: 'Compra no ateliê, presente ou troca', icon: 'brush' },
  { key: 'INHERITED', name: 'Herdei ou ganhei', description: 'Herança, doação ou presente de família', icon: 'family_restroom' },
]

/**
 * Where a gallery's artwork comes from (handoff "Web Galeria" › Cadastrar obra › "De onde vem esta obra?").
 * Stored in the same `Artwork.acquisitionKind` column as the collector's origin: one column for "where it
 * came from", two allowlists (the member kind says which applies). "Define a divisão da venda": a
 * consignment follows the artist's contract; the rest is the gallery's own.
 */
export const GALLERY_SOURCE_KINDS = ['CONSIGNMENT', 'OWN_STOCK', 'COLLECTOR_RESALE', 'OTHER'] as const
export type GallerySourceKind = (typeof GALLERY_SOURCE_KINDS)[number]
export const GALLERY_SOURCE_CARDS: { key: GallerySourceKind; name: string; description: string; icon: string }[] = [
  { key: 'CONSIGNMENT', name: 'Consignação de artista', description: 'Obra de artista representado, com divisão por contrato', icon: 'handshake' },
  { key: 'OWN_STOCK', name: 'Acervo próprio da galeria', description: 'Obra comprada pela galeria', icon: 'storefront' },
  { key: 'COLLECTOR_RESALE', name: 'Revenda para colecionador', description: 'Mercado secundário, obra de terceiro', icon: 'swap_horiz' },
  { key: 'OTHER', name: 'Outro', description: 'Doação, permuta, espólio', icon: 'more_horiz' },
]
/** Every value `Artwork.acquisitionKind` takes (the collector's and the gallery's). */
export const ORIGIN_KINDS = [...ACQUISITION_KINDS, ...GALLERY_SOURCE_KINDS] as const
/**
 * Whether an origin makes the sale a SECONDARY one (lib/offers listArtworkForSale): everything a collector
 * registered already changed hands; of the gallery's, only the resale for a collector — a consignment,
 * the gallery's own stock or "outro" is the first sale, with the primary split and no resale royalty.
 */
export function isSecondaryOrigin(kind: string | null | undefined): boolean {
  if (!kind) return false
  return (ACQUISITION_KINDS as readonly string[]).includes(kind) || kind === 'COLLECTOR_RESALE'
}

export const HISTORY_KINDS = ['EXHIBITION', 'PUBLICATION', 'AWARD', 'RESTORATION', 'LOAN'] as const
export const HISTORY_KIND_LABELS: Record<(typeof HISTORY_KINDS)[number], string> = {
  EXHIBITION: 'Exposição', PUBLICATION: 'Publicação', AWARD: 'Prêmio', RESTORATION: 'Restauro', LOAN: 'Empréstimo',
}

export const SALE_MODES = ['FIXED', 'FIXED_WITH_OFFERS', 'ON_REQUEST'] as const
export const SALE_MODE_CARDS: { key: (typeof SALE_MODES)[number]; name: string; description: string }[] = [
  { key: 'FIXED', name: 'Preço fixo', description: 'O comprador paga o valor e a venda segue direto.' },
  { key: 'FIXED_WITH_OFFERS', name: 'Preço fixo e aceitar ofertas', description: 'Você recebe propostas; o negociador responde pela sua alçada.' },
  { key: 'ON_REQUEST', name: 'Sob consulta', description: 'O preço não aparece; interessados pedem contato.' },
]

export const MEDIA_KINDS = ['FRONT_COLOR_CARD', 'BACK', 'MACRO_TL', 'MACRO_TR', 'MACRO_BL', 'MACRO_BR', 'SIGNATURE', 'DETAIL', 'SIDE', 'IN_SITU', 'OTHER'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]
export interface MediaSlot {
  kind: MediaKind
  name: string
  /** the guide shown in the capture (handoff: apps › Cadastrar obra / Nova obra · câmera guiada) */
  hint: string
  icon: string
  required: boolean
  /** the colour card overlay belongs to the front shot */
  colorCard?: true
  /** macro: the region of the artwork the guide points to, as CSS transform-origin */
  focus?: string
}
/**
 * The capture slots of the "Mídia" step, in the design order: the six fixed
 * shots of the certification (front with colour card, back, four macros) are
 * required; signature, surface detail, side and in-situ are optional.
 */
export const MEDIA_SLOTS: MediaSlot[] = [
  { kind: 'FRONT_COLOR_CARD', name: 'Frontal com cartão de cor', hint: 'Obra inteira no quadro, celular paralelo à tela. Cartão de cor no canto, luz difusa e sem flash.', icon: 'crop_portrait', required: true, colorCard: true },
  { kind: 'BACK', name: 'Verso', hint: 'Chassi inteiro à vista, com etiquetas antigas, carimbos e anotações. É aqui que a etiqueta será colada.', icon: 'flip', required: true },
  { kind: 'MACRO_TL', name: 'Macro 1 · sup. esq.', hint: 'Aproxime até ver a trama da tela.', icon: 'center_focus_weak', required: true, focus: '12% 12%' },
  { kind: 'MACRO_TR', name: 'Macro 2 · sup. dir.', hint: 'Mesma distância da anterior.', icon: 'center_focus_weak', required: true, focus: '88% 12%' },
  { kind: 'MACRO_BL', name: 'Macro 3 · inf. esq.', hint: 'Inclua a pincelada mais marcada da região.', icon: 'center_focus_weak', required: true, focus: '12% 88%' },
  { kind: 'MACRO_BR', name: 'Macro 4 · inf. dir.', hint: 'Mantenha o celular paralelo à obra.', icon: 'center_focus_weak', required: true, focus: '88% 88%' },
  { kind: 'SIGNATURE', name: 'Assinatura', hint: 'Aproxime até ler a assinatura e a data com nitidez.', icon: 'draw', required: false, focus: '85% 88%' },
  { kind: 'DETAIL', name: 'Detalhe da superfície', hint: 'A um palmo de distância, numa área com pincelada ou textura marcada.', icon: 'texture', required: false },
  { kind: 'SIDE', name: 'Lateral', hint: 'Espessura do chassi e acabamento da borda.', icon: 'view_sidebar', required: false },
  { kind: 'IN_SITU', name: 'Na parede', hint: 'Ajuda o comprador a entender a escala. Inclua um móvel ou a porta.', icon: 'chair', required: false },
]
export const REQUIRED_MEDIA_SLOTS = MEDIA_SLOTS.filter((s) => s.required)
/** The kinds the PUBLIC artwork page shows, in the order of its strip (the macros stay with the certificate). */
export const PUBLIC_MEDIA_KINDS = ['FRONT_COLOR_CARD', 'BACK', 'DETAIL', 'SIGNATURE', 'IN_SITU'] as const
export const CAPTURE_TIPS: { icon: string; text: string }[] = [
  { icon: 'wb_sunny', text: 'Luz natural indireta, perto de uma janela. Evite sol direto e flash.' },
  { icon: 'straighten', text: 'Celular paralelo à obra, na altura do centro dela.' },
  { icon: 'palette', text: 'Deixe o cartão de cor no canto na foto da frente. Usamos para calibrar a cor.' },
  { icon: 'block', text: 'Tire vidro ou acrílico se puder. Reflexos escondem detalhes.' },
]
export const MEDIA_QUALITIES = ['GOOD', 'BLURRY', 'PENDING'] as const
export const MEDIA_QUALITY_LABELS: Record<(typeof MEDIA_QUALITIES)[number], string> = { GOOD: 'Boa', BLURRY: 'Desfocada', PENDING: 'Pendente' }

export const WIZARD_STEPS = ['Ficha técnica', 'Mídia', 'Condition report', 'Histórico', 'Preço e disponibilidade', 'Revisão'] as const

/** List filters of "Minhas obras" → statuses. */
export const LIST_FILTERS: { key: string; name: string; statuses: readonly ArtworkStatus[] | null }[] = [
  { key: 'all', name: 'Todas', statuses: null },
  { key: 'authenticated', name: 'Autenticadas', statuses: ['AUTHENTICATED'] },
  { key: 'certifying', name: 'Em certificação', statuses: ['IN_CERTIFICATION'] },
  { key: 'listed', name: 'À venda', statuses: ['LISTED', 'IN_DEAL'] },
  { key: 'sold', name: 'Vendidas', statuses: ['SOLD'] },
  { key: 'drafts', name: 'Rascunhos', statuses: ['DRAFT'] },
]

export function isArtworkStatus(s: string): s is ArtworkStatus {
  return (ARTWORK_STATUSES as readonly string[]).includes(s)
}

export function formatDimensions(a: { heightMm: number | null; widthMm: number | null; depthMm: number | null }): string {
  const cm = (mm: number | null) => (mm === null ? null : (mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
  const parts = [cm(a.heightMm), cm(a.widthMm), cm(a.depthMm)].filter((p): p is string => p !== null)
  return parts.length ? `${parts.join(' × ')} cm` : '—'
}

export function formatBRL(cents: bigint | number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  const n = Number(cents) / 100
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
