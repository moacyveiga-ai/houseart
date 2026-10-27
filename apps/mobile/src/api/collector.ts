// The calls of the screens that left the WebView in "telas restantes nativas":
// Compras e Confirmar recebimento, Vendas do colecionador, Cadastrar obra,
// Vender esta obra, Carteira e cartões, Pix para receber e Verificar obra.
// Thin wrappers over `api()`: the server decides every rule (the phase of a
// deal, whether a tap is valid, the estimate of a sale, whether a Pix key is
// the holder's). The minimum the owner accepts goes UP with the sale and never
// comes back: no call here reads it.
import { api } from './client'
import type { DealPhase } from './gallery'

/** GET /api/collector/purchases → the buyer's deals (the web DealView without the split; BigInt as string). */
export interface PurchaseDeal {
  id: number; code: string; phase: DealPhase; progressPct: number; artworkTitle: string; artist: string; sellerName: string; cover: string | null
  amountCents: string; shippingCents: string; insuranceCents: string; market: string; buyerName: string
  steps: { phase: DealPhase; title: string; icon: string; description: string; date: string | null; state: 'done' | 'on' | 'todo' }[]
  shipping: { carrier: string | null; tracking: string | null; insurer: string | null } | null
  sellerSigned: boolean; buyerSigned: boolean; escrowPaid: boolean; completedAt: string | null
  /** CANCELLED | DISPUTE | … (the web hides "Falar com o vendedor" on a cancelled deal; the server refuses it) */
  exception?: string | null
}
export interface Purchases { deals: PurchaseDeal[]; simulateAllowed: boolean }
export const purchases = (): Promise<Purchases> => api<Purchases>('/api/collector/purchases')
export const payEscrow = (dealId: number) => api<{ ok: boolean }>(`/api/deals/${dealId}/escrow`, { body: {} })
/** The buyer opens (or reopens) the conversation with who sold the artwork — the web's "Falar com o vendedor". */
export const openDealConversation = (dealId: number) => api<{ ok: boolean; id: number }>(`/api/deals/${dealId}/conversation`, { body: {} })
export const signAsBuyer = (dealId: number) => api<{ ok: boolean }>(`/api/deals/${dealId}/sign`, { body: {} })
/** The tap of the delivery: the SUN message of the tag, or (the server decides: mock vendor) the simulated tap with no read. */
export const confirmDelivery = (dealId: number, sun: { uid: string; ctr: number; cmac: string } | null) => api<{ ok: boolean }>(`/api/deals/${dealId}/confirm-delivery`, { body: sun ?? {} })

/** POST /api/collector/artworks — the collector's own artwork: origin + artist → a draft the camera completes. */
export type AcquisitionKind = 'BOUGHT_OUTSIDE' | 'FROM_ARTIST' | 'INHERITED'
export interface RegisterInput { acquisitionKind: AcquisitionKind; artistName: string; title?: string; acquisitionYear?: number; acquisitionFrom?: string; acquisitionNote?: string; acquisitionPriceCents?: string }
export const registerArtwork = (input: RegisterInput) => api<{ ok: boolean; id: number }>('/api/collector/artworks', { body: input })

/** GET /api/collector/artworks/[id]/sell-estimate → the estimate of "Revise o anúncio" (the server's math). */
export interface SellEstimate { listCents: string; buyerFeeCents: string; buyerPaysCents: string; sellerFeeCents: string; royaltyCents: string; appreciationCents: string; netCents: string }
export const sellEstimate = async (artworkId: number, listCents: bigint): Promise<{ estimate: SellEstimate; registeredCents: string | null }> =>
  api(`/api/collector/artworks/${artworkId}/sell-estimate?listPriceCents=${listCents.toString()}`)
export interface SellInput { listPriceCents: string; reservePriceCents: string; autoNegotiatorOn: boolean; autoAcceptMinBps: number; fixedPrice: boolean }
/** POST /api/collector/artworks/[id]/sell — the mandate goes up once; nothing of it comes back. */
export const sellArtwork = (artworkId: number, input: SellInput) => api<{ ok: boolean }>(`/api/collector/artworks/${artworkId}/sell`, { body: input })
/** POST /api/collector/artworks/[id]/services — "Pedir certificação" of an artwork without the green seal. */
export const orderService = (artworkId: number, code: string) => api<{ ok: boolean; quote?: boolean }>(`/api/collector/artworks/${artworkId}/services`, { body: { code } })

/** Cards of the wallet (the add is `addCard` of market.ts). */
export const setDefaultCard = (id: number) => api<{ ok: boolean }>(`/api/collector/payment-methods/${id}`, { method: 'PATCH', body: { default: true } })
export const removeCard = (id: number) => api<{ ok: boolean }>(`/api/collector/payment-methods/${id}`, { method: 'DELETE' })

/** GET/PUT/DELETE /api/member/payout-account — the seller's Pix key (only the mask comes back). */
export type PixKeyType = 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM'
export interface PayoutAccount { pixKeyType: string; pixKeyMask: string; holderName: string }
export const payoutAccount = async (): Promise<PayoutAccount | null> => (await api<{ ok: boolean; account: PayoutAccount | null }>('/api/member/payout-account')).account
export const savePayoutAccount = async (type: PixKeyType, key: string, holderName: string): Promise<PayoutAccount> =>
  (await api<{ ok: boolean; account: PayoutAccount }>('/api/member/payout-account', { method: 'PUT', body: { type, key, holderName } })).account
export const removePayoutAccount = () => api<{ ok: boolean }>('/api/member/payout-account', { method: 'DELETE' })

/** Verificar: GET /api/public/certificates (search), GET /api/v1/certificates/[publicId] (the page), POST …/read (the tag). */
export type Verdict = 'authenticated' | 'contested' | 'stolen'
export interface CertificateHit { publicId: string; title: string; year: number | null; artist: string; technique: string | null; cover: string | null; verdict: Verdict }
export interface PublicCertificate {
  publicId: string; status: 'ACTIVE' | 'CONTESTED' | 'REVOKED' | 'PENDING'; verdict: Verdict
  artwork: { title: string; year: number | null; technique: string | null; dimensions: string; category: string; edition: string | null; cover: string | null }
  artist: string; artistSlug: string; artistMeta: string | null; holder: string | null; issuedAt: string | null; version: number | null
  holders: number; sale: { seller: string; priceCents: string | null } | null; appraisalIssuedAt: string | null
  disputedAt: string | null; stolenAt: string | null; events: { seq: number; kind: string; label: string; at: string }[]
}
export interface TagReadResult { authenticated: boolean; tamper: boolean }
export const searchCertificates = async (q: { id: string } | { artist: string; title: string; year: string }): Promise<CertificateHit[]> => {
  const qs = 'id' in q ? `id=${encodeURIComponent(q.id)}` : `artist=${encodeURIComponent(q.artist)}&title=${encodeURIComponent(q.title)}&year=${encodeURIComponent(q.year)}`
  return (await api<{ ok: boolean; results: CertificateHit[] }>(`/api/public/certificates?${qs}`, { anonymous: true })).results
}
export const publicCertificate = (publicId: string): Promise<PublicCertificate> => api<PublicCertificate>(`/api/v1/certificates/${encodeURIComponent(publicId)}`, { anonymous: true })
export const readTag = async (publicId: string, sun: { uid: string; ctr: number; cmac: string }): Promise<TagReadResult> =>
  (await api<{ ok: boolean; read: TagReadResult }>(`/api/public/certificates/${encodeURIComponent(publicId)}/read`, { body: sun, anonymous: true })).read
