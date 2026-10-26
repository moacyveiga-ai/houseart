import { describe, expect, it } from 'vitest'
import { artIndexAt, artIndexQuote, deltaLabel, parseAwesome, parseSgs, tickerItemsOf } from './core'

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)
const sale = (iso: string, reais: number) => ({ amountCents: BigInt(reais * 100), at: day(iso) })

describe('faixa de índices', () => {
  it('formats the strip like the design; the index reads "—" without sales; a currency never fetched is left out', () => {
    expect(tickerItemsOf([{ key: 'HA_INDEX', valueMicros: 112_400_000n, changeBps: 80 }, { key: 'USD_BRL', valueMicros: 5_420_000n, changeBps: 12 }, { key: 'EUR_BRL', valueMicros: 6_110_000n, changeBps: null }]))
      .toEqual([{ label: 'Índice HouseArt', value: '112,4', delta: '+0,8%' }, { label: 'Dólar', value: 'R$ 5,42' }, { label: 'Euro', value: 'R$ 6,11' }])
    expect(tickerItemsOf([{ key: 'HA_INDEX', valueMicros: null, changeBps: null }, { key: 'USD_BRL', valueMicros: 5_420_000n, changeBps: null }]))
      .toEqual([{ label: 'Índice HouseArt', value: '—' }, { label: 'Dólar', value: 'R$ 5,42' }])
    expect(deltaLabel(-120)).toBe('−1,2%')
    expect(deltaLabel(0)).toBe('0,0%')
  })

  it('reads AwesomeAPI and skips what is odd', () => {
    const q = parseAwesome({ USDBRL: { bid: '5.4210', pctChange: '0.12', timestamp: '1793000000' }, EURBRL: { bid: 'abc' } })
    expect(q).toEqual([{ key: 'USD_BRL', valueMicros: 5_421_000n, changeBps: 12, observedAt: new Date(1793000000 * 1000) }])
    expect(parseAwesome(null)).toEqual([])
  })

  it('reads PTAX (SGS) with the change vs the day before', () => {
    const q = parseSgs([{ data: '23/10/2026', valor: '5.4000' }, { data: '24/10/2026', valor: '5.4540' }], 'USD_BRL')
    expect(q).toMatchObject({ key: 'USD_BRL', valueMicros: 5_454_000n, changeBps: 100 })
    expect(parseSgs([], 'EUR_BRL')).toBeNull()
  })

  it('the HouseArt index: 100 on the base window, the mean of the last 90 days against it, "—" without recent sales', () => {
    const sales = [sale('2026-01-10', 40_000), sale('2026-02-10', 60_000), sale('2026-09-01', 55_000), sale('2026-10-20', 57_500)]
    expect(artIndexAt(sales, day('2026-03-01'))).toBe(100)
    expect(artIndexAt(sales, day('2026-10-26'))).toBe(112.5) // (55 000 + 57 500)/2 ÷ (40 000 + 60 000)/2
    expect(artIndexAt(sales, day('2026-08-01'))).toBeNull() // nothing in the last 90 days
    expect(artIndexAt([], day('2026-10-26'))).toBeNull()
    const q = artIndexQuote(sales, day('2026-10-20'))
    expect(q.valueMicros).toBe(112_500_000n)
    expect(q.changeBps).toBe(227) // 110,0 the day before (only the 55 000 sale) → 112,5
  })
})
