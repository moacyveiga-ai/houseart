// Header ticker: the cron writes dollar, euro and the HouseArt index; a source that fails falls back to
// PTAX or keeps the last good value; the shell reads only the table. No real network (fetch is injected).
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { refreshMarketIndicators, tickerItems } from '@/lib/market-indicators/server'
import { truncateTables } from './db'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const awesome = { USDBRL: { bid: '5.42', pctChange: '0.10', timestamp: '1793000000' }, EURBRL: { bid: '6.11', pctChange: '-0.20', timestamp: '1793000000' } }

beforeEach(async () => {
  // completed deals left by other files would turn the index into a number
  await truncateTables(['MarketQuote', 'Deal'])
})

describe('faixa de índices (cron)', () => {
  it('writes the currencies and the index ("—" without sales); the shell reads them in the design order', async () => {
    const r = await refreshMarketIndicators(new Date(), async () => json(awesome))
    expect(r.updated.sort()).toEqual(['EUR_BRL', 'HA_INDEX', 'USD_BRL'])
    expect(await tickerItems()).toEqual([{ label: 'Índice HouseArt', value: '—' }, { label: 'Dólar', value: 'R$ 5,42' }, { label: 'Euro', value: 'R$ 6,11' }])
  }, 60_000)

  it('AwesomeAPI down → PTAX; everything down → the last good value stays', async () => {
    await refreshMarketIndicators(new Date(), async () => json(awesome))
    const ptax = await refreshMarketIndicators(new Date(), async (url) => (url.includes('awesomeapi') ? json({}, 503) : json([{ data: '23/10/2026', valor: '5.40' }, { data: '24/10/2026', valor: '5.50' }])))
    expect(ptax.updated).toContain('USD_BRL')
    expect((await prisma.marketQuote.findUniqueOrThrow({ where: { key: 'USD_BRL' } })).source).toBe('bcb-ptax')
    const down = await refreshMarketIndicators(new Date(), async () => { throw new TypeError('fetch failed') })
    expect(down.errors.length).toBeGreaterThan(0)
    expect((await prisma.marketQuote.findUniqueOrThrow({ where: { key: 'USD_BRL' } })).valueMicros).toBe(5_500_000n)
  }, 60_000)
})
