// PURE helpers of the screens that left the WebView (Compras, Vendas do
// colecionador, Cadastrar obra, Vender esta obra, Carteira e cartões, Pix,
// Verificar). No I/O, no React. The server is the authority on every rule:
// what lives here only shapes texts and decides which button the screen shows.
import type { PurchaseDeal, AcquisitionKind, PixKeyType, Verdict } from '@/api/collector'
import { colors, theme } from '@/theme'
import { parseSunUrl, type SunRead } from '../artist/artist-core'
import { priceReais } from '../gallery/gallery-core'

// ── Compras ───────────────────────────────────────────────────────────────
/** What the buyer does now in a deal: pay in escrow, sign, wait for the seller, confirm with the tap, or nothing. */
export type BuyerAction = 'pay' | 'sign' | 'wait-seller' | 'wait-shipping' | 'receive' | 'done'
export function buyerAction(d: Pick<PurchaseDeal, 'phase' | 'buyerSigned' | 'sellerSigned'>): BuyerAction {
  switch (d.phase) {
    case 'OFFER_ACCEPTED': return 'pay'
    case 'ESCROW': return d.buyerSigned ? 'wait-seller' : 'sign'
    case 'DOCUMENTS': return 'wait-shipping'
    case 'SHIPPING':
    case 'DELIVERY': return 'receive'
    case 'TRANSFER': return 'wait-seller'
    case 'COMPLETED': return 'done'
  }
  return 'wait-seller'
}

/** The total paid (or to pay) in escrow: work + shipping + insurance. */
export const escrowTotalCents = (d: Pick<PurchaseDeal, 'amountCents' | 'shippingCents' | 'insuranceCents'>): number =>
  Number(d.amountCents) + Number(d.shippingCents) + Number(d.insuranceCents)

/** The pill of a purchase in the list (the prototype's `stCompra`): text and tint. */
export function purchasePill(d: Pick<PurchaseDeal, 'phase' | 'buyerSigned' | 'sellerSigned'>): { label: string; bg: string; fg: string } {
  switch (buyerAction(d)) {
    case 'pay': return { label: 'Oferta aceita · pagar', bg: colors.verified100, fg: colors.verified500 }
    case 'sign': return { label: 'Assinar o termo de transferência', bg: colors.sand100, fg: theme.fg }
    case 'wait-seller': return { label: 'Aguardando o vendedor', bg: colors.pending100, fg: theme.fg }
    case 'wait-shipping': return { label: 'Embalagem e envio', bg: colors.pending100, fg: theme.fg }
    case 'receive': return { label: 'Entrega · toque na etiqueta', bg: colors.sand100, fg: theme.fg }
    case 'done': return { label: 'Concluída · escritura emitida', bg: colors.verified100, fg: colors.verified500 }
  }
}

/** The title and text of the current stage (prototype `cpStTitulo` / `cpStTexto`). */
export function purchaseStage(d: Pick<PurchaseDeal, 'phase' | 'buyerSigned' | 'sellerSigned' | 'steps'>): { title: string; text: string } {
  const a = buyerAction(d)
  if (a === 'done') return { title: 'A obra é sua', text: 'Escritura emitida em seu nome. O pagamento foi liberado ao vendedor e a obra está na sua coleção.' }
  if (a === 'pay') return { title: 'Oferta aceita', text: 'Pague em garantia para garantir a obra. O valor fica retido até a entrega.' }
  if (a === 'sign') return { title: 'Pagamento em garantia', text: 'Valor retido. Assine o termo de transferência para o vendedor preparar o envio.' }
  if (a === 'receive') return { title: 'Entrega · toque na etiqueta', text: 'Encoste o celular no verso para confirmar. A leitura confirma a posse: o pagamento é liberado ao vendedor e a escritura passa para o seu nome no mesmo instante.' }
  const on = d.steps.find((s) => s.state === 'on')
  return { title: on?.title ?? 'Em andamento', text: a === 'wait-seller' && d.phase === 'ESCROW' ? 'Você já assinou. Aguardando a assinatura do vendedor.' : on ? `${on.description}.` : '' }
}

/** Purchases still running (the "Em garantia" balance and the tab count). */
export const livePurchases = (deals: PurchaseDeal[]): PurchaseDeal[] => deals.filter((d) => d.phase !== 'COMPLETED')
/** Sum held in escrow: deals paid and not completed. */
export const heldInEscrowCents = (deals: PurchaseDeal[]): number => deals.filter((d) => d.escrowPaid && d.phase !== 'COMPLETED').reduce((t, d) => t + escrowTotalCents(d), 0)

// ── Confirmar recebimento ─────────────────────────────────────────────────
/** A pasted tag URL for the delivery: the SUN read, or nothing usable. */
export const parseDeliveryRead = (input: string): SunRead | null => parseSunUrl(input)

// ── Cadastrar obra ────────────────────────────────────────────────────────
/** The three origins of `ACQUISITION_KIND_CARDS` (lib/artworks/domain) — the prototype's "Outro" has no domain. */
export const ACQUISITION_CARDS: { key: AcquisitionKind; name: string; description: string; icon: 'shopping-bag' | 'brush' | 'family-restroom' }[] = [
  { key: 'BOUGHT_OUTSIDE', name: 'Comprei fora da HouseArt', description: 'Em galeria, feira ou direto de outra pessoa', icon: 'shopping-bag' },
  { key: 'FROM_ARTIST', name: 'Recebi do próprio artista', description: 'Compra no ateliê, presente ou troca', icon: 'brush' },
  { key: 'INHERITED', name: 'Herdei ou ganhei', description: 'Herança, doação ou presente de família', icon: 'family-restroom' },
]
export const REGISTER_STEPS: readonly (readonly [string, string])[] = [
  ['Como a obra chegou até você?', 'Isso define quais documentos e serviços fazem sentido para ela.'],
  ['Quem é o artista?', 'Busque pelo nome. Se não estiver na lista, escreva o nome como aparece na assinatura.'],
  ['Sobre a aquisição', 'De quem, quando e por quanto. O valor pago fica só com você.'],
]

export interface RegisterForm { kind: AcquisitionKind | null; artistName: string; title: string; year: string; from: string; paid: string; note: string }
/** The body of POST /api/collector/artworks (what the web RegisterArtworkScreen sends). */
export function registerBody(f: RegisterForm): { ok: true; body: { acquisitionKind: AcquisitionKind; artistName: string; title?: string; acquisitionYear?: number; acquisitionFrom?: string; acquisitionNote?: string; acquisitionPriceCents?: string } } | { ok: false; error: string } {
  if (!f.kind) return { ok: false, error: 'Diga como a obra chegou até você.' }
  const artistName = f.artistName.trim()
  if (artistName.length < 2) return { ok: false, error: 'Informe o artista.' }
  const y = Number(f.year)
  const paid = priceReais(f.paid)
  return {
    ok: true,
    body: {
      acquisitionKind: f.kind, artistName,
      ...(f.title.trim() ? { title: f.title.trim() } : {}),
      ...(/^\d{4}$/.test(f.year) && y > 1800 && y < 2200 ? { acquisitionYear: y } : {}),
      ...(f.from.trim() ? { acquisitionFrom: f.from.trim() } : {}),
      ...(f.note.trim() ? { acquisitionNote: f.note.trim() } : {}),
      ...(paid > 0 ? { acquisitionPriceCents: String(paid * 100) } : {}),
    },
  }
}

// ── Vender esta obra ──────────────────────────────────────────────────────
export type SellMode = 'offers' | 'fixed'
/** The auto-accept minimum typed as a whole percentage → bps, clamped to 50–100 % (the web `autoAcceptBps`). */
export function autoAcceptBps(pct: string): number {
  const n = Number(String(pct ?? '').replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 10000
  return Math.min(100, Math.max(50, n)) * 100
}
/**
 * The local checks of "Preço e modalidade" (the same sentences the server's
 * mandate check answers, in the person's words). The server checks again.
 */
export function sellProblems(listReais: number, minReais: number, mode: SellMode, bps: number): string[] {
  const out: string[] = []
  if (listReais <= 0) return ['Informe o preço pedido.']
  if (mode === 'fixed') return out
  if (minReais <= 0) out.push('Informe o mínimo que você aceita.')
  else if (minReais > listReais) out.push('O mínimo não pode passar do preço pedido.')
  else if ((listReais * bps) / 10000 < minReais) out.push('O aceite automático não pode ficar abaixo do seu mínimo.')
  return out
}

// ── Pix ───────────────────────────────────────────────────────────────────
export const PIX_TYPES: { key: PixKeyType; name: string; icon: 'badge' | 'alternate-email' | 'smartphone' | 'vpn-key'; label: string; placeholder: string; keyboard: 'number-pad' | 'email-address' | 'phone-pad' | 'default' }[] = [
  { key: 'CPF', name: 'CPF', icon: 'badge', label: 'Seu CPF', placeholder: '000.000.000-00', keyboard: 'number-pad' },
  { key: 'EMAIL', name: 'E-mail', icon: 'alternate-email', label: 'E-mail cadastrado no banco', placeholder: 'voce@email.com', keyboard: 'email-address' },
  { key: 'PHONE', name: 'Celular', icon: 'smartphone', label: 'Celular cadastrado no banco', placeholder: '(71) 99999-9999', keyboard: 'phone-pad' },
  { key: 'RANDOM', name: 'Aleatória', icon: 'vpn-key', label: 'Chave aleatória', placeholder: '7d9f3c2a-41b8-4e6d-9a0f-2c5e8b1d7a63', keyboard: 'default' },
]
export const maskCpf = (v: string): string => v.replace(/\D/g, '').slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length < 3) return d
  if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
export const pixKeyInput = (type: PixKeyType, v: string): string => (type === 'CPF' ? maskCpf(v) : type === 'PHONE' ? maskPhone(v) : v)
/** The format checks of the prototype's `salvarPix` (the holder check is the server's). */
export function pixKeyProblem(type: PixKeyType, raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (type === 'CPF') return d.length === 11 ? null : 'Digite os 11 números do CPF.'
  if (type === 'EMAIL') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.trim()) ? null : 'Digite um e-mail válido.'
  if (type === 'PHONE') return d.length === 11 ? null : 'Digite o celular com DDD.'
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.trim()) ? null : 'A chave aleatória tem 32 caracteres no formato do seu banco.'
}
export const PIX_TYPE_LABEL: Record<string, string> = { CPF: 'CPF', CNPJ: 'CNPJ', EMAIL: 'E-mail', PHONE: 'Celular', RANDOM: 'Aleatória' }

// ── Verificar ─────────────────────────────────────────────────────────────
const PUBLIC_ID_RE = /^HA-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/
/**
 * What the person typed or pasted in Verificar: a tag URL (`…/a/HA-…?uid&ctr&cmac`
 * or `…/verify/HA-…?…`), a bare `?uid&ctr&cmac` (the number is found by the
 * tag's serial), a certificate number, or free text searched as a number.
 */
export type VerifyInput = { kind: 'tag'; publicId: string | null; sun: SunRead } | { kind: 'id'; id: string } | null
export function parseVerifyInput(input: string): VerifyInput {
  const text = (input ?? '').trim()
  if (!text) return null
  const sun = parseSunUrl(text)
  const path = /\/(?:a|verify)\/([^/?#\s]+)/i.exec(text)
  const fromPath = path ? decodeURIComponent(path[1]!).toUpperCase() : null
  const publicId = fromPath && PUBLIC_ID_RE.test(fromPath) ? fromPath : null
  if (sun) return { kind: 'tag', publicId, sun }
  if (publicId) return { kind: 'id', id: publicId }
  return { kind: 'id', id: text.toUpperCase().replace(/\s+/g, '') }
}

export const VERDICT: Record<Verdict, { icon: 'verified' | 'report' | 'gpp-bad'; title: string; bg: string; fg: string }> = {
  authenticated: { icon: 'verified', title: 'Obra autenticada', bg: colors.verified100, fg: colors.verified500 },
  contested: { icon: 'report', title: 'Autenticidade contestada', bg: colors.pending100, fg: colors.pending500 },
  stolen: { icon: 'gpp-bad', title: 'Obra registrada como roubada', bg: colors.alert100, fg: colors.alert500 },
}

const dataBR = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }) : '—')
/** The banner text of the web Verification (`bannerText`). */
export function verdictText(c: { verdict: Verdict; stolenAt: string | null; disputedAt: string | null }, read: { authenticated: boolean } | null): string {
  if (c.verdict === 'stolen') return `O titular comunicou o furto${c.stolenAt ? ` em ${dataBR(c.stolenAt)}` : ''}. Não compre esta obra e avise o suporte.`
  if (c.verdict === 'contested') return `Há uma contestação aberta sobre esta obra${c.disputedAt ? ` desde ${dataBR(c.disputedAt)}` : ''}. Antes de comprar, fale com o suporte.`
  if (read?.authenticated) return 'Etiqueta lida agora e conferida com o certificado registrado.'
  return 'Certificado registrado e assinado na HouseArt.'
}
/** The "Etiqueta de autenticação" line of the web Verification (`markerLine`). */
export function markerLine(c: { verdict: Verdict; issuedAt: string | null }, read: { authenticated: boolean; tamper: boolean } | null): string {
  if (read?.tamper) return 'Violada · em revisão'
  if (c.verdict === 'stolen') return 'Bloqueada'
  if (c.verdict === 'contested') return 'Íntegra · em revisão'
  if (read && !read.authenticated) return 'Leitura não confirmada'
  return `Íntegra · vinculada em ${dataBR(c.issuedAt)}`
}
export { dataBR }

/** "DD/MM/AAAA" (what the person types) → "AAAA-MM-DD" (what the server reads); empty stays empty, anything else goes as typed and the server says "Data inválida". */
export function restorationDay(input: string): string {
  const v = input.trim()
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v
}
/** Typing mask of the date: digits only, slashes after the day and the month. */
export const maskDay = (v: string): string => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
