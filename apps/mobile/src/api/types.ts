// DTOs of the JSON routes the app reads (mirrors of the server shapes; BigInt
// cents arrive as strings). Never a floor, never a document hash.

/** GET /api/collector/explore → { items } */
export interface ExploreItem {
  id: number; publicId: string; title: string; year: number | null; artist: string; category: string
  priceCents: string | null; saleMode: string | null; cover: string | null
  technique: string | null; dimensions: string; seller: string; sellerKind: 'GALLERY' | 'PRIVATE'; market: 'PRIMARY' | 'SECONDARY' | null; uf: string | null
  liked: boolean; saved: boolean
}

/** GET /api/public/artworks/[publicId] */
export interface ArtworkPage {
  id: number; publicId: string; title: string; year: number | null; artist: string; artistSlug: string; category: string
  status: string; certificateStatus: 'PENDING' | 'ACTIVE' | 'CONTESTED' | 'REVOKED'
  priceCents: string | null; saleMode: string | null; cover: string | null
  technique: string | null; materials: string | null; dimensions: string
  edition: string | null; conditionGrade: string | null
  media: { kind: string; url: string }[]; fixedPrice: boolean; acceptsOffers: boolean
  history: { kind: string; description: string; occurredOn: string }[]
  events: { kind: string; label: string; at: string }[]
  seller: { name: string; kind: 'GALLERY' | 'PRIVATE'; slug: string | null; city: string | null; uf: string | null; representsArtist: boolean }
  artistProfile: { slug: string; name: string; livesIn: string | null; bio: string | null; certifiedCount: number; forSaleCount: number }
  liked: boolean; saved: boolean
}

/** GET /api/collector/wallet → { items, totalCents, holderName } */
export interface WalletItem {
  artworkId: number; publicId: string | null; title: string; artist: string; cover: string | null
  acquiredAt: string; priceLabel: string; insured: boolean; holderName: string; version: number
  status: string; sealGreen: boolean; registeredCents: string | null; artistId: number | null
}

/** GET /api/collector/favorites → { items } */
export interface FavoriteItem {
  id: number; publicId: string; title: string; year: number | null; artist: string; priceCents: string | null; saleMode: string | null; status: string; cover: string | null; liked: boolean; saved: boolean; at: string
}

/** GET /api/messages → { items } */
export interface ConversationRow { id: number; artworkId: number | null; artworkTitle: string | null; artworkPublicId: string | null; artworkCoverUrl: string | null; other: { id: number; name: string; initials: string; sub: string; avatarUrl?: string | null }; preview: string; when: string; unread: number }
/** GET /api/messages/[id] → { header, messages } */
export interface MessageRow { id: number; mine: boolean; kind: 'TEXT' | 'SYSTEM' | 'OFFER' | 'COUNTER' | 'IMAGE'; body: string; at: string; offerId: number | null; imageUrl?: string | null }

/** GET /api/public/search?q= */
export interface SearchResult {
  q: string
  artworks: { id: number; publicId: string; title: string; year: number | null; artist: string; priceCents: string | null; saleMode: string | null; cover: string | null; category: string }[]
  artists: { slug: string; name: string; meta: string; count: number; photoUrl: string | null }[]
  galleries: { slug: string; name: string; city: string; uf: string | null; works: number; artists: number }[]
  total: number
}

/** GET /api/collector/payment-methods → { methods } (never the provider token). */
export interface PaymentMethodView { id: number; brand: string; brandLabel: string; last4: string; holderName: string; exp: string; isDefault: boolean; label: string }

/** GET /api/auth/identity → { identity } */
export interface IdentityView { name: string; cpfMask: string | null; phoneMask: string | null; phoneVerified: boolean; emailVerified: boolean; city: string }

export type GuaranteeMethod = 'CARD_HOLD' | 'PIX_RESERVE' | 'TRANSFER_ON_ACCEPT'

/** GET /api/collector/offers/[code] → { offer } (the BuyerOffer of the web page; BigInt as string, never the mandate). */
export interface BuyerOfferView {
  code: string; artworkTitle: string; artworkPublicId: string | null; artistName: string | null; artworkCover: string | null; listPriceCents: string | null
  offeredCents: string; currentCents: string; status: string; statusLabel: string; expiresAt: string; createdAt: string
  rounds: { number: number; author: string; amountCents: string; message: string | null; at: string }[]
  canRetract: boolean; canReply: boolean
  validityHours: number; guaranteeMethod: string; shippingCents: string; insuranceCents: string; deliveryCep: string | null; message: string | null
  counterCents: string | null; counterMessage: string | null
}

/** GET /api/public/community/feed → { items } */
export interface FeedAuthor { name: string; initials: string; sub: string; memberId: number | null; memberSlug: string | null; following: boolean; profileHref?: string | null; avatarUrl?: string | null }
export interface FeedItem {
  key: string
  kind: 'PHOTO' | 'TEXT' | 'POLL' | 'EVENT' | 'NEWS' | 'AGENDA'
  id: number
  author: FeedAuthor
  when: string
  body: string
  imageUrl: string | null
  artwork: { publicId: string; title: string } | null
  title?: string; summary?: string | null; format?: string | null; href?: string
  day?: string; month?: string; venue?: string; startsAt?: string | null; going?: number; iAmGoing?: boolean
  poll?: { options: { label: string; count: number; pct: number }[]; myVote: number | null; total: number }
  likes: number; liked: boolean; saved: boolean; comments: number; canComment: boolean
}

/** GET /api/public/community/comments?target=&targetId= → { items } */
export interface CommentRow { id: number; author: FeedAuthor; body: string; when: string; likes: number; liked: boolean; mine: boolean }
