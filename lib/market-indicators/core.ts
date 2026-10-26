// Header ticker (HOUSEART_BUILD D.25 / E.15) — PURE. "Índice HouseArt 112,4 +0,8% · Dólar R$ 5,42 ·
// Euro R$ 6,11". The currencies come from AwesomeAPI (PTAX of the Banco Central as fallback); the
// HouseArt index is our own: the moving average of the platform's sales (90 days) normalized to 100
// on the first window with sales. Without sales it reads "—". Numbers travel as micros (value × 10⁶).

export const QUOTE_KEYS = ['HA_INDEX', 'USD_BRL', 'EUR_BRL'] as const
export type QuoteKey = (typeof QUOTE_KEYS)[number]
export const QUOTE_LABELS: Record<QuoteKey, string> = { HA_INDEX: 'Índice HouseArt', USD_BRL: 'Dólar', EUR_BRL: 'Euro' }

/** The moving-average window of the index, in days. */
export const INDEX_WINDOW_DAYS = 90
const DAY = 86_400_000

export interface QuoteRow { key: string; valueMicros: bigint | null; changeBps: number | null; observedAt?: Date | null }

/** A currency older than this is left out of the strip (every source down for days): never shown as current. */
export const STALE_CURRENCY_DAYS = 5
export interface TickerItem { label: string; value: string; delta?: string }

const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "+0,8%" / "−1,2%" / "0,0%" from basis points. */
export function deltaLabel(bps: number): string {
  const pct = bps / 100
  const s = nf1.format(Math.abs(pct))
  return pct > 0 ? `+${s}%` : pct < 0 ? `−${s}%` : `${s}%`
}

/**
 * The ticker in the order of the design. The index always shows (with "—" when there are no sales);
 * a currency never fetched yet is left out rather than shown as "R$ 0,00".
 */
export function tickerItemsOf(rows: QuoteRow[], now: Date = new Date()): TickerItem[] {
  const by = new Map(rows.map((r) => [r.key, r]))
  const out: TickerItem[] = []
  const idx = by.get('HA_INDEX')
  if (idx?.valueMicros != null) out.push({ label: QUOTE_LABELS.HA_INDEX, value: nf1.format(Number(idx.valueMicros) / 1e6), ...(idx.changeBps != null ? { delta: deltaLabel(idx.changeBps) } : {}) })
  else out.push({ label: QUOTE_LABELS.HA_INDEX, value: '—' })
  for (const key of ['USD_BRL', 'EUR_BRL'] as const) {
    const r = by.get(key)
    const fresh = !r?.observedAt || now.getTime() - r.observedAt.getTime() <= STALE_CURRENCY_DAYS * DAY
    if (r?.valueMicros != null && fresh) out.push({ label: QUOTE_LABELS[key], value: `R$ ${nf2.format(Number(r.valueMicros) / 1e6)}` })
  }
  return out
}

export interface ParsedQuote { key: 'USD_BRL' | 'EUR_BRL'; valueMicros: bigint; changeBps: number | null; observedAt: Date | null }

const toMicros = (n: number) => BigInt(Math.round(n * 1e6))
const okRate = (n: number) => Number.isFinite(n) && n > 0 && n < 1000

/** AwesomeAPI `/json/last/USD-BRL,EUR-BRL` → the quotes it carries (bid, pctChange in %). Anything odd is skipped. */
export function parseAwesome(json: unknown): ParsedQuote[] {
  if (!json || typeof json !== 'object') return []
  const out: ParsedQuote[] = []
  for (const [code, key] of [['USDBRL', 'USD_BRL'], ['EURBRL', 'EUR_BRL']] as const) {
    const q = (json as Record<string, unknown>)[code] as Record<string, unknown> | undefined
    if (!q) continue
    const bid = Number(q.bid)
    if (!okRate(bid)) continue
    const pct = Number(q.pctChange)
    const ts = Number(q.timestamp)
    out.push({ key, valueMicros: toMicros(bid), changeBps: Number.isFinite(pct) ? Math.round(pct * 100) : null, observedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null })
  }
  return out
}

/** BCB SGS `/dados/ultimos/2?formato=json` (PTAX venda) → the last value and its change vs the one before. */
export function parseSgs(json: unknown, key: 'USD_BRL' | 'EUR_BRL'): ParsedQuote | null {
  if (!Array.isArray(json) || json.length === 0) return null
  const pts = json.map((p) => {
    const r = p as Record<string, unknown>
    const [d, m, y] = String(r.data ?? '').split('/').map(Number)
    return { v: Number(String(r.valor ?? '').replace(',', '.')), at: y && m && d ? new Date(Date.UTC(y, m - 1, d, 16)) : null }
  }).filter((p) => okRate(p.v))
  const last = pts[pts.length - 1]
  if (!last) return null
  const prev = pts.length > 1 ? pts[pts.length - 2] : null
  return { key, valueMicros: toMicros(last.v), changeBps: prev ? Math.round((last.v / prev.v - 1) * 10_000) : null, observedAt: last.at }
}

export interface Sale { amountCents: bigint; at: Date }

/** ART_INDEX_BASE_START ("2026-11-01"): the day the index starts counting sales. Invalid or empty = from the first sale. */
export function parseBaseStart(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null
  const d = new Date(`${v.trim()}T00:00:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const meanIn = (sales: Sale[], from: number, to: number): number | null => {
  const xs = sales.filter((s) => s.at.getTime() > from && s.at.getTime() <= to)
  if (!xs.length) return null
  return xs.reduce((t, s) => t + Number(s.amountCents), 0) / xs.length
}

/**
 * The HouseArt index at `now`: 100 × (mean sale of the last INDEX_WINDOW_DAYS) ÷ (mean sale of the
 * base window — the first INDEX_WINDOW_DAYS from the first sale on or after `baseStart`). Sales before
 * `baseStart` (ART_INDEX_BASE_START: the launch, so demo sales never set the base) never count.
 * Null without a sale in the current window (the ticker reads "—").
 */
export function artIndexAt(sales: Sale[], now: Date, baseStart: Date | null = null): number | null {
  const done = sales.filter((s) => s.at.getTime() <= now.getTime() && (!baseStart || s.at.getTime() >= baseStart.getTime()))
  if (!done.length) return null
  const first = done.reduce((m, s) => Math.min(m, s.at.getTime()), Infinity)
  const w = INDEX_WINDOW_DAYS * DAY
  const base = meanIn(done, first - 1, first + w)
  const cur = meanIn(done, now.getTime() - w, now.getTime())
  if (!base || cur === null) return null
  return Math.round((cur / base) * 1000) / 10
}

/** The index now and its change vs a day before (bps), as the cron stores it. */
export function artIndexQuote(sales: Sale[], now: Date, baseStart: Date | null = null): { valueMicros: bigint | null; changeBps: number | null } {
  const v = artIndexAt(sales, now, baseStart)
  if (v === null) return { valueMicros: null, changeBps: null }
  const before = artIndexAt(sales, new Date(now.getTime() - DAY), baseStart)
  return { valueMicros: toMicros(v), changeBps: before ? Math.round((v / before - 1) * 10_000) : null }
}
