// Shipping estimate of the public artwork page — PURE. There is no carrier
// provider yet: the quote is deterministic by destination (CEP → UF → region
// distance from the seller's UF) and by the size of the work, so the page can
// show the three carriers of the design with an honest "estimativa até o
// checkout". Money in cents (bigint-free: the amounts are small integers).

export const CARRIERS = [
  { key: 'ALVES_TEGAM', name: 'Alves Tegam', baseCents: 89_000, baseDays: 5 },
  { key: 'FINK', name: 'Fink', baseCents: 102_000, baseDays: 4 },
  { key: 'CONVELIO', name: 'Convelio', baseCents: 76_000, baseDays: 7 },
] as const
export type CarrierKey = (typeof CARRIERS)[number]['key']

export interface ShippingQuote { carrier: CarrierKey; name: string; days: number; priceCents: number }

export interface ArtworkSize { heightMm: number | null; widthMm: number | null; depthMm: number | null }

/** Digits only; null unless exactly 8 digits. */
export function normalizeCep(input: string): string | null {
  const d = input.replace(/\D/g, '')
  return d.length === 8 ? d : null
}

export const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`

// Ranges of the first five digits of the CEP by UF (Correios).
const CEP_RANGES: [number, number, string][] = [
  [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
  [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
  [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
  [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
  [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 72799, 'DF'],
  [72800, 72999, 'GO'], [73000, 73699, 'DF'], [73700, 76799, 'GO'], [76800, 76999, 'RO'],
  [77000, 77999, 'TO'], [78000, 78899, 'MT'], [78900, 78999, 'RO'], [79000, 79999, 'MS'],
  [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS'],
]

export function ufFromCep(cep: string): string | null {
  const n = normalizeCep(cep)
  if (!n) return null
  const prefix = Number(n.slice(0, 5))
  return CEP_RANGES.find(([lo, hi]) => prefix >= lo && prefix <= hi)?.[2] ?? null
}

const REGION: Record<string, 'N' | 'NE' | 'CO' | 'SE' | 'S'> = {
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MS: 'CO', MT: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', RS: 'S', SC: 'S',
}

// Distance zone between regions: 1 = same UF, 2 = same region, 3 = neighbour, 4 = far.
const FAR: Record<string, string[]> = { N: ['SE', 'S'], NE: ['S'], CO: [], SE: ['N'], S: ['N', 'NE'] }

export function zoneOf(fromUf: string | null, toUf: string): 1 | 2 | 3 | 4 {
  const to = toUf.toUpperCase()
  const from = (fromUf ?? 'BA').toUpperCase()
  if (from === to) return 1
  const rf = REGION[from] ?? 'NE'
  const rt = REGION[to] ?? 'NE'
  if (rf === rt) return 2
  return FAR[rf].includes(rt) ? 4 : 3
}

export type SizeClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL'

/** By the longest side: ≤ 60 cm small, ≤ 120 medium, ≤ 200 large, above XL. */
export function sizeClassOf(size: ArtworkSize): SizeClass {
  const longest = Math.max(size.heightMm ?? 0, size.widthMm ?? 0, size.depthMm ?? 0)
  if (longest <= 600) return 'SMALL'
  if (longest <= 1200) return 'MEDIUM'
  if (longest <= 2000) return 'LARGE'
  return 'XL'
}

const SIZE_FACTOR: Record<SizeClass, number> = { SMALL: 0.6, MEDIUM: 1, LARGE: 1.6, XL: 2.4 }
const ZONE_FACTOR: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 1.35, 3: 1.8, 4: 2.3 }
const ZONE_DAYS: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 2, 3: 3, 4: 5 }

const wholeReais = (cents: number) => Math.round(cents / 100) * 100 || 100

/** The three quotes, in the order of the design. `toUf` unknown → null (the page asks for a CEP). */
export function quoteShipping(input: { fromUf: string | null; toUf: string | null; size: ArtworkSize }): ShippingQuote[] | null {
  if (!input.toUf || !REGION[input.toUf.toUpperCase()]) return null
  const zone = zoneOf(input.fromUf, input.toUf)
  const factor = SIZE_FACTOR[sizeClassOf(input.size)] * ZONE_FACTOR[zone]
  return CARRIERS.map((c) => ({ carrier: c.key, name: c.name, days: c.baseDays + ZONE_DAYS[zone], priceCents: wholeReais(Math.round(c.baseCents * factor)) }))
}

/** Transit insurance: 0,58 % of the price, whole reais, at least R$ 60. */
export function insuranceCents(priceCents: number): number {
  return Math.max(6_000, wholeReais(Math.round((priceCents * 58) / 10_000)))
}

/** "ou 10× de R$ 3.800 sem juros": the instalment, floored to whole reais. */
export function installmentCents(priceCents: number, n = 10): number {
  return Math.floor(priceCents / n / 100) * 100
}

export const cheapest = (quotes: ShippingQuote[]): ShippingQuote => quotes.reduce((a, b) => (b.priceCents < a.priceCents ? b : a))
