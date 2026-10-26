// The collector's artwork side panel — the display shape (PURE: the client island imports it).
export interface CollectorPanelData {
  mode: 'market' | 'owner'
  id: number; publicId: string | null; title: string; artist: string; artistSlug: string | null; ficha: string
  images: { url: string; label: string }[]
  priceLabel: string; price: string; priceSub: string
  signals: { likes: number; liked: boolean; saved: boolean; comments: number } | null
  certificate: { code: string | null; text: string; ok: boolean }
  provenance: { k: string; v: string }[]
  seller: { name: string; initials: string; sub: string } | null
  market: { acceptsOffers: boolean; buyable: boolean; reserved: boolean } | null
  owner: { status: string; sealGreen: boolean; registeredCents: string | null; insured: boolean; insurer: string | null; holderName: string; holderMask: string | null; acquiredAt: string; version: number; transferOn: boolean; cover: string | null } | null
}
