// Deal split — PURE. Fixed cascade (brief §commission):
//   primary market: PLATFORM 12 % of the amount; the rest to the seller
//     (ARTIST, or GALLERY + ARTIST by the consignment bps when the seller is a gallery);
//   secondary market: PLATFORM 8 % charged to the buyer ON TOP (not in the split
//     of the amount) + 4 % from the seller + ARTIST_ROYALTY (5 % × appreciation).
// Everything BigInt; integer division truncates and the residue goes to the seller.
export type SplitParty = 'ARTIST' | 'GALLERY' | 'PLATFORM' | 'ADVISOR' | 'ARTIST_ROYALTY' | 'SHIPPING' | 'INSURANCE'

export interface SplitLine { party: SplitParty; bps: number; amountCents: bigint }

export interface SplitInput {
  amountCents: bigint
  market: 'PRIMARY' | 'SECONDARY'
  /** who sells: the artist directly, or a gallery that keeps `galleryBps` of the seller share */
  seller: 'ARTIST' | 'GALLERY'
  galleryBps?: number
  royaltyCents?: bigint
  platformPrimaryBps?: number
  platformSecondarySellerBps?: number
}

export const DEFAULT_PLATFORM_PRIMARY_BPS = 1200
export const DEFAULT_PLATFORM_SECONDARY_BUYER_BPS = 800
export const DEFAULT_PLATFORM_SECONDARY_SELLER_BPS = 400

export function computeSplit(i: SplitInput): SplitLine[] {
  if (i.amountCents <= 0n) throw new Error('split: amount must be positive')
  const platformBps = i.market === 'PRIMARY' ? (i.platformPrimaryBps ?? DEFAULT_PLATFORM_PRIMARY_BPS) : (i.platformSecondarySellerBps ?? DEFAULT_PLATFORM_SECONDARY_SELLER_BPS)
  const platform = (i.amountCents * BigInt(platformBps)) / 10000n
  const royalty = i.market === 'SECONDARY' ? (i.royaltyCents ?? 0n) : 0n
  const sellerShare = i.amountCents - platform - royalty
  if (sellerShare < 0n) throw new Error('split: negative seller share')
  const lines: SplitLine[] = [{ party: 'PLATFORM', bps: platformBps, amountCents: platform }]
  if (royalty > 0n) lines.push({ party: 'ARTIST_ROYALTY', bps: Number((royalty * 10000n) / i.amountCents), amountCents: royalty })
  if (i.seller === 'GALLERY' && (i.galleryBps ?? 0) > 0) {
    const gallery = (sellerShare * BigInt(i.galleryBps!)) / 10000n
    lines.push({ party: 'GALLERY', bps: Number((gallery * 10000n) / i.amountCents), amountCents: gallery })
    lines.push({ party: 'ARTIST', bps: Number(((sellerShare - gallery) * 10000n) / i.amountCents), amountCents: sellerShare - gallery })
  } else {
    lines.push({ party: i.seller, bps: Number((sellerShare * 10000n) / i.amountCents), amountCents: sellerShare })
  }
  assertInvariants(i.amountCents, lines)
  return lines
}

export function assertInvariants(amountCents: bigint, lines: SplitLine[]): void {
  const sum = lines.reduce((a, l) => a + l.amountCents, 0n)
  if (sum !== amountCents) throw new Error(`split: lines sum ${sum} ≠ amount ${amountCents}`)
  if (lines.some((l) => l.amountCents < 0n)) throw new Error('split: negative line')
}

/** What the buyer pays on a secondary sale: amount + the buyer's platform fee. */
export function buyerTotalCents(amountCents: bigint, market: 'PRIMARY' | 'SECONDARY', buyerBps = DEFAULT_PLATFORM_SECONDARY_BUYER_BPS): bigint {
  return market === 'SECONDARY' ? amountCents + (amountCents * BigInt(buyerBps)) / 10000n : amountCents
}

export const SPLIT_PARTY_LABELS: Record<SplitParty, string> = {
  ARTIST: 'Artista', GALLERY: 'Galeria', PLATFORM: 'HouseArt', ADVISOR: 'Consultor', ARTIST_ROYALTY: 'Direito de sequência', SHIPPING: 'Transporte', INSURANCE: 'Seguro',
}
