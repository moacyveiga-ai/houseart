// The calls of the App Galeria (painel do dia, acervo, gestão do anúncio,
// ofertas, vendas, regras, equipe, artistas). Thin wrappers over `api()`:
// the server is the authority on every rule (the asked price can never go
// under the mandate's minimum — the app never receives that number).
import { api } from './client'

/** GET /api/gallery/panel → { ok, panel } */
export interface PanelKpi { key: string; label: string; value: string; detail: string; icon: string; href: string; dark?: true }
export interface PanelAction { icon: string; title: string; sub: string; tag: string; tone: 'pending' | 'alert' | 'neutral'; href: string }
export interface PanelTop { id: number; title: string; coverUrl: string | null; views7d: number; openOffers: number }
export interface DayPanel { dateLabel: string; name: string; initials: string; kpis: PanelKpi[]; actions: PanelAction[]; top: PanelTop[] }

/** GET /api/gallery/inventory → { ok, items, counts, summary } */
export type ArtworkStatus = 'DRAFT' | 'IN_CERTIFICATION' | 'AUTHENTICATED' | 'LISTED' | 'IN_DEAL' | 'SOLD' | 'ARCHIVED' | 'STOLEN' | 'DISPUTED'
export interface InventoryItem {
  id: number; title: string; year: number | null; artistName: string; status: ArtworkStatus
  listPriceCents: string | null; saleMode: string | null; publicId: string | null; coverUrl: string | null
  listing: { views7d: number; openOffers: number; paused: boolean } | null
}
export interface Inventory { items: InventoryItem[]; counts: Record<string, number>; summary: string }

/** GET /api/gallery/artworks/[id] → { ok, artwork, listing, rules } */
export interface ListingHead { id: number; title: string; year: number | null; artistName: string; publicId: string | null; coverUrl: string | null; status: ArtworkStatus }
export interface ListingState { listPriceCents: string; acceptsOffers: boolean; fixedPrice: boolean; paused: boolean; stats: { views7d: number; views30d: number; openOffers: number } }
export interface ListingRules { refuseBelowBps: number; responseHours: number }
export interface ListingDetail { artwork: ListingHead; listing: ListingState | null; rules: ListingRules | null }

export const dayPanel = async (): Promise<DayPanel> => (await api<{ ok: boolean; panel: DayPanel }>('/api/gallery/panel')).panel
export const inventory = (): Promise<Inventory> => api<Inventory>('/api/gallery/inventory')
export const listingDetail = (artworkId: number): Promise<ListingDetail> => api<ListingDetail>(`/api/gallery/artworks/${artworkId}`)

/** PATCH /api/artworks/[id]/listing — one field at a time; the server answers with the listing (or the error, e.g. a price under the minimum). */
export async function patchListing(artworkId: number, body: { listPriceCents?: string } | { acceptsOffers: boolean } | { paused: boolean }): Promise<ListingState> {
  const r = await api<{ listing: { listPriceCents: string | number; acceptsOffers: boolean; fixedPrice: boolean; paused: boolean; stats: { views7d: number; views30d: number; openOffers: number } } }>(`/api/artworks/${artworkId}/listing`, { method: 'PATCH', body })
  return { ...r.listing, listPriceCents: String(r.listing.listPriceCents) }
}

/** GET /api/offers → OfferRow[] (the seller's projection; never the buyer's document). */
export type OfferStatus = 'RECEIVED' | 'BELOW_RESERVE' | 'NEGOTIATING' | 'ACCEPTED' | 'IN_DEAL' | 'CONVERTED' | 'REFUSED' | 'EXPIRED' | 'RETRACTED' | 'CANCELLED' | string
export interface OfferRow {
  id: number; code: string; artworkId: number; artworkTitle: string; artworkCover: string | null; listPriceCents: string | null
  offeredCents: string; currentCents: string; status: OfferStatus; statusLabel: string; buyer: string; expiresIn: string; differenceLabel: string
  open: boolean; rounds: { number: number; author: string; amountCents: string; message: string | null; at: string }[]; createdAt: string
}
export const sellerOffers = (): Promise<OfferRow[]> => api<OfferRow[]>('/api/offers')
export const acceptOffer = (id: number) => api<{ ok: boolean }>(`/api/offers/${id}/accept`, { body: {} })
export const refuseOffer = (id: number) => api<{ ok: boolean }>(`/api/offers/${id}/refuse`, { body: {} })
export const counterOffer = (id: number, amountCents: number, message?: string) => api<{ ok: boolean }>(`/api/offers/${id}/counter`, { body: { amountCents, message } })

/** GET /api/gallery/deals → { ok, deals } (the DealView of the web timeline; BigInt as string). */
export type DealPhase = 'OFFER_ACCEPTED' | 'ESCROW' | 'DOCUMENTS' | 'SHIPPING' | 'DELIVERY' | 'TRANSFER' | 'COMPLETED'
export interface DealView {
  id: number; code: string; phase: DealPhase; progressPct: number; artworkTitle: string; artist: string; sellerName: string; cover: string | null
  amountCents: string; shippingCents: string; insuranceCents: string; market: string; buyerName: string
  steps: { phase: DealPhase; title: string; icon: string; description: string; date: string | null; state: 'done' | 'on' | 'todo' }[]
  split: { party: string; label: string; amountCents: string; status: string; payoutState?: string; payoutLabel?: string }[]
  shipping: { carrier: string | null; tracking: string | null; insurer: string | null } | null
  sellerSigned: boolean; buyerSigned: boolean; escrowPaid: boolean; completedAt: string | null
}
export const sellerDeals = async (): Promise<DealView[]> => (await api<{ ok: boolean; deals: DealView[] }>('/api/gallery/deals')).deals
export const signDeal = (id: number) => api<{ ok: boolean }>(`/api/deals/${id}/sign`, { body: {} })
export const bookShipping = (id: number, input: { carrier: string; tracking: string; insurer?: string }) => api<{ ok: boolean }>(`/api/deals/${id}/shipping`, { body: input })

/** GET/PUT /api/gallery/rules → { ok, rules } */
export interface OfferRules { refuseLow: boolean; refuseBelowBps: number; autoAcceptOn: boolean; autoAcceptMinBps: number; responseHours: number; notifyTeam: boolean }
export const REFUSE_BELOW_OPTIONS = [6000, 7000, 8000] as const
export const RESPONSE_HOURS_OPTIONS = [24, 48, 72] as const
export const offerRules = async (): Promise<OfferRules> => (await api<{ ok: boolean; rules: OfferRules }>('/api/gallery/rules')).rules
export const saveOfferRules = async (patch: Partial<OfferRules>): Promise<OfferRules> => (await api<{ ok: boolean; rules: OfferRules }>('/api/gallery/rules', { method: 'PUT', body: patch })).rules

/** GET /api/gallery/team → { ok, people } */
export type TeamRole = 'ADMIN' | 'SALES' | 'INVENTORY'
export interface TeamPerson { kind: 'MEMBER' | 'INVITE'; id: number; name: string; email: string | null; role: TeamRole; roleLabel: string; sub: string; isSelf: boolean }
export const TEAM_ROLES: { key: TeamRole; name: string; sub: string }[] = [
  { key: 'ADMIN', name: 'Admin', sub: 'Todas as permissões' },
  { key: 'SALES', name: 'Vendas', sub: 'Ofertas, mensagens e vendas' },
  { key: 'INVENTORY', name: 'Acervo', sub: 'Cadastro, fotos e certificação' },
]
type People = { ok: boolean; people: TeamPerson[] }
export const team = async (): Promise<TeamPerson[]> => (await api<People>('/api/gallery/team')).people
export const inviteToTeam = async (email: string, role: TeamRole): Promise<TeamPerson[]> => (await api<People>('/api/gallery/team', { body: { email, role } })).people
export const setTeamRole = async (memberId: number, role: TeamRole): Promise<TeamPerson[]> => (await api<People>(`/api/gallery/team/${memberId}`, { method: 'PATCH', body: { role } })).people
export const removeFromTeam = async (memberId: number): Promise<TeamPerson[]> => (await api<People>(`/api/gallery/team/${memberId}`, { method: 'DELETE' })).people
export const revokeInvite = async (inviteId: number): Promise<TeamPerson[]> => (await api<People>(`/api/gallery/team/invites/${inviteId}`, { method: 'DELETE' })).people

/** GET /api/gallery/artists → { ok, artists } */
export interface RepresentedArtist { id: number; name: string; slug: string; works: number; forSale: number; contract: { kind: 'REPRESENTED' | 'CONSIGNMENT'; kindLabel: string; galleryBps: number; validUntil: string | null } | null; hasAccount: boolean; sub: string }
export const representedArtists = async (): Promise<RepresentedArtist[]> => (await api<{ ok: boolean; artists: RepresentedArtist[] }>('/api/gallery/artists')).artists
