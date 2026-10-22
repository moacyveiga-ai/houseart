// The collector as seller — PURE helpers of the wallet sheets (SellSheet,
// ServicesSheet) and of "Cadastrar obra": the reais mask of the prototype
// (digits grouped by thousands, no cents), digits → cents, the estimate the
// sell sheet shows (secondary market: 8 % from the buyer on top, 4 % from the
// seller, resale royalty of 5 % over the appreciation against the registered
// value) and the order of the services list. No I/O.
import { DEFAULT_PLATFORM_SECONDARY_BUYER_BPS, DEFAULT_PLATFORM_SECONDARY_SELLER_BPS, buyerTotalCents } from '@/lib/commission/split-core'
import { RESALE_ROYALTY_BPS, royaltyFor } from '@/lib/resale-royalty/core'

/** Keeps only digits, as the prototype's `fmtN`. */
export function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13)
}

/** "12500" → "12.500" (reais without cents, pt-BR grouping). */
export function formatThousands(digits: string): string {
  const d = digitsOf(digits)
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}

/** Reais typed as digits → cents (BigInt). Empty → 0n. */
export function reaisDigitsToCents(digits: string): bigint {
  const d = digitsOf(digits)
  return d ? BigInt(d) * 100n : 0n
}

export const SECONDARY_BUYER_PCT = DEFAULT_PLATFORM_SECONDARY_BUYER_BPS / 100
export const SECONDARY_SELLER_PCT = DEFAULT_PLATFORM_SECONDARY_SELLER_BPS / 100
export const ROYALTY_PCT = RESALE_ROYALTY_BPS / 100

export interface SellEstimate {
  listCents: bigint
  /** 8 % the buyer pays on top of the list price */
  buyerFeeCents: bigint
  buyerPaysCents: bigint
  /** 4 % the seller leaves with HouseArt */
  sellerFeeCents: bigint
  /** 5 % of the appreciation over the registered value (what the collector paid) */
  royaltyCents: bigint
  appreciationCents: bigint
  /** the seller's net: list − 4 % − royalty */
  netCents: bigint
}

/**
 * The estimate the sheet shows. `registeredCents` is the value the wallet
 * registers for the artwork (what the collector paid, when known); without it
 * the royalty cannot be estimated and comes back as 0n with `appreciationCents` 0n.
 */
export function sellEstimate(listCents: bigint, registeredCents: bigint | null): SellEstimate {
  const list = listCents > 0n ? listCents : 0n
  const buyerPays = buyerTotalCents(list, 'SECONDARY')
  const sellerFee = (list * BigInt(DEFAULT_PLATFORM_SECONDARY_SELLER_BPS)) / 10000n
  const r = registeredCents !== null && registeredCents > 0n ? royaltyFor(list, registeredCents) : { appreciationCents: 0n, royaltyCents: 0n }
  return { listCents: list, buyerFeeCents: buyerPays - list, buyerPaysCents: buyerPays, sellerFeeCents: sellerFee, royaltyCents: r.royaltyCents, appreciationCents: r.appreciationCents, netCents: list - sellerFee - r.royaltyCents }
}

/** The auto-accept minimum typed as a whole percentage → bps, clamped to what the mandate accepts (50–100 %). */
export function autoAcceptBps(pct: string): number {
  const n = Number(digitsOf(pct))
  if (!Number.isFinite(n) || n <= 0) return 10000
  return Math.min(100, Math.max(50, n)) * 100
}

/** Services list order of the prototype: certification first, then the catalog order. */
export function orderServices<T extends { code: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.code === 'CERTIFICATION' ? -1 : b.code === 'CERTIFICATION' ? 1 : 0))
}

export const SERVICE_ICONS: Record<string, string> = {
  CERTIFICATION: 'verified', APPRAISAL_SIGNED: 'request_quote', PROVENANCE_CHECK: 'fact_check', APPRAISAL_FORENSIC: 'biotech',
  COLLECTION_INSURANCE: 'shield', TRANSIT_INSURANCE: 'local_shipping', SHIPPING: 'package_2', PARTNER_SERVICE: 'handshake',
}

/** Price label of a service: "Sob orçamento" for quotes (no price), otherwise the price with its unit. */
export function servicePriceLabel(s: { priceCents: string; unit: string }, formatBRL: (c: bigint) => string): string {
  const cents = /^\d+$/.test(s.priceCents) ? BigInt(s.priceCents) : 0n
  if (s.unit === 'QUOTE' || cents === 0n) return 'Sob orçamento'
  return s.unit === 'WEEK' ? `${formatBRL(cents)}/semana` : formatBRL(cents)
}
