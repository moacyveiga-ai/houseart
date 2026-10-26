import { describe, expect, it } from 'vitest'
import { saleAction, saleFinance, saleSegments, saleStage, saleStageTitle, saleSteps, SALE_STAGES } from './sale-progress-core'

describe('Vendas até o repasse', () => {
  it('six steps, stage from the deal phase', () => {
    expect(SALE_STAGES).toHaveLength(6)
    expect(saleStage('OFFER_ACCEPTED')).toBe(-1)
    expect(saleStage('ESCROW')).toBe(0)
    expect(saleStage('SHIPPING')).toBe(3)
    expect(saleStage('COMPLETED')).toBe(5)
    expect(saleSegments('DOCUMENTS')).toEqual(['on', 'on', 'off', 'off', 'off', 'off'])
    expect(saleSegments('COMPLETED')).toEqual(Array(6).fill('done'))
    expect(saleSegments('OFFER_ACCEPTED')).toEqual(Array(6).fill('off'))
    expect(saleSteps('SHIPPING').map((s) => s.state)).toEqual(['done', 'done', 'done', 'on', 'todo', 'todo'])
    expect(saleSteps('COMPLETED').every((s) => s.state === 'done')).toBe(true)
  })
  it('the action the seller owes', () => {
    expect(saleAction({ phase: 'ESCROW', sellerSigned: false, exception: null })).toMatchObject({ kind: 'sign', tone: 'pending' })
    expect(saleAction({ phase: 'ESCROW', sellerSigned: true, exception: null })).toMatchObject({ kind: null, label: 'Aguardando comprador' })
    expect(saleAction({ phase: 'DOCUMENTS', sellerSigned: true, exception: null })).toMatchObject({ kind: 'ship' })
    expect(saleAction({ phase: 'COMPLETED', sellerSigned: true, exception: null })).toMatchObject({ tone: 'done' })
    expect(saleAction({ phase: 'DOCUMENTS', sellerSigned: true, exception: 'CANCELLED' })).toMatchObject({ kind: null, tone: 'off' })
    expect(saleStageTitle('OFFER_ACCEPTED', null)).toBe('Aguardando o pagamento em garantia')
  })
  it('finance: gallery sale shows the artist share and "Galeria recebe"', () => {
    const f = saleFinance({ amountCents: 1_000_000n, market: 'PRIMARY', sellerKind: 'GALLERY_STAFF', artistName: 'Joana', split: [{ party: 'PLATFORM', amountCents: 120_000n }, { party: 'GALLERY', amountCents: 440_000n }, { party: 'ARTIST', amountCents: 440_000n }] })
    expect(f.map((l) => l.label)).toEqual(['Valor da venda', 'Comissão HouseArt · 12%', 'Repasse a Joana · 50% do líquido', 'Galeria recebe'])
    expect(f.at(-1)!.cents).toBe(440_000n)
  })
  it('finance: artist sale says "Você recebe" the ARTIST line', () => {
    const f = saleFinance({ amountCents: 1_000_000n, market: 'PRIMARY', sellerKind: 'ARTIST', artistName: 'Joana', split: [{ party: 'PLATFORM', amountCents: 120_000n }, { party: 'ARTIST', amountCents: 880_000n }] })
    expect(f.at(-1)).toMatchObject({ label: 'Você recebe', cents: 880_000n })
  })
  it('finance: a collector resale receives the GALLERY line (old deals show the artist share as a deduction)', () => {
    const old = saleFinance({ amountCents: 1_000_000n, market: 'SECONDARY', sellerKind: 'COLLECTOR', artistName: 'Joana', split: [{ party: 'PLATFORM', amountCents: 40_000n }, { party: 'ARTIST_ROYALTY', amountCents: 25_000n }, { party: 'GALLERY', amountCents: 430_000n }, { party: 'ARTIST', amountCents: 505_000n }] })
    expect(old.at(-1)).toMatchObject({ label: 'Você recebe', cents: 430_000n })
    expect(old.map((l) => l.label)).toContain('Repasse a Joana · 54% do líquido')
    const f = saleFinance({ amountCents: 1_000_000n, market: 'SECONDARY', sellerKind: 'COLLECTOR', artistName: 'Joana', split: [{ party: 'PLATFORM', amountCents: 40_000n }, { party: 'ARTIST_ROYALTY', amountCents: 25_000n }, { party: 'GALLERY', amountCents: 935_000n }, { party: 'SHIPPING', amountCents: 5_000n }] })
    expect(f.map((l) => l.label)).toEqual(['Valor da venda', 'Comissão HouseArt · 4%', 'Direito de sequência · Joana', 'Você recebe'])
    expect(f.at(-1)!.cents).toBe(935_000n)
  })
})
