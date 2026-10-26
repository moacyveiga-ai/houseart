// Header ticker — I/O. The cron (`/api/cron/market-indicators`) fetches the currencies (AwesomeAPI;
// PTAX of the Banco Central per currency it could not get) and recomputes the HouseArt index from the
// completed deals; each series is written on its own and a failed fetch keeps the last good value.
// The shell only READS the table (`tickerItems`) — the browser never calls the sources.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { artIndexQuote, parseAwesome, parseSgs, tickerItemsOf, type ParsedQuote, type TickerItem } from './core'

const AWESOME_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL'
const SGS_SERIES: Record<'USD_BRL' | 'EUR_BRL', number> = { USD_BRL: 1, EUR_BRL: 21619 }
const TIMEOUT_MS = 8000

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

async function getJson(fetchFn: Fetch, url: string): Promise<unknown> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** The currencies: AwesomeAPI first, PTAX for any it did not give. Never throws. */
export async function fetchCurrencies(fetchFn: Fetch = fetch): Promise<{ quotes: (ParsedQuote & { source: string })[]; errors: string[] }> {
  const errors: string[] = []
  const quotes: (ParsedQuote & { source: string })[] = []
  try { for (const q of parseAwesome(await getJson(fetchFn, AWESOME_URL))) quotes.push({ ...q, source: 'awesomeapi' }) }
  catch (e) { errors.push(`awesomeapi: ${(e as Error).name}`) }
  for (const key of ['USD_BRL', 'EUR_BRL'] as const) {
    if (quotes.some((q) => q.key === key)) continue
    try {
      const q = parseSgs(await getJson(fetchFn, `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_SERIES[key]}/dados/ultimos/2?formato=json`), key)
      if (q) quotes.push({ ...q, source: 'bcb-ptax' })
      else errors.push(`bcb ${key}: vazio`)
    } catch (e) { errors.push(`bcb ${key}: ${(e as Error).name}`) }
  }
  return { quotes, errors }
}

/** The cron: currencies + index. Each series written on its own; nothing fetched = nothing touched. */
export async function refreshMarketIndicators(now = new Date(), fetchFn: Fetch = fetch): Promise<{ updated: string[]; errors: string[] }> {
  return totalScope('market-indicators', async () => {
    const { quotes, errors } = await fetchCurrencies(fetchFn)
    const updated: string[] = []
    for (const q of quotes) {
      await prisma.marketQuote.upsert({ where: { key: q.key }, create: { key: q.key, valueMicros: q.valueMicros, changeBps: q.changeBps, observedAt: q.observedAt, source: q.source }, update: { valueMicros: q.valueMicros, changeBps: q.changeBps, observedAt: q.observedAt, source: q.source } })
      updated.push(q.key)
    }
    // the platform's sales: every completed deal, by the day it completed
    const deals = await prisma.deal.findMany({ where: { phase: 'COMPLETED', completedAt: { not: null }, exceptionStatus: null }, select: { amountCents: true, completedAt: true } })
    const idx = artIndexQuote(deals.map((d) => ({ amountCents: d.amountCents, at: d.completedAt! })), now)
    await prisma.marketQuote.upsert({ where: { key: 'HA_INDEX' }, create: { key: 'HA_INDEX', ...idx, observedAt: now, source: 'platform' }, update: { ...idx, observedAt: now, source: 'platform' } })
    updated.push('HA_INDEX')
    return { updated, errors }
  })
}

/** What the shell shows (the table only). Empty when nothing was ever written (the strip stays hidden). */
export async function tickerItems(): Promise<TickerItem[]> {
  const rows = await prisma.marketQuote.findMany({ select: { key: true, valueMicros: true, changeBps: true } })
  return rows.length ? tickerItemsOf(rows) : []
}
