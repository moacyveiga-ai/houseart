import { describe, expect, it } from 'vitest'
import { batchPayload, batchResultText, canList, needsMarker, reaisToCents, selectionText, summarize, type SelectableWork } from './select-core'

const w = (over: Partial<SelectableWork>): SelectableWork => ({ id: 1, title: 'Obra', year: 2024, status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-1', listPriceCents: null, ...over })

describe('selection summary', () => {
  it('counts markers (works before the certificate) and listable works (green seal, authenticated)', () => {
    const s = summarize([
      w({ id: 1 }), // listable
      w({ id: 2, status: 'DRAFT', seal: 'NONE', publicId: null }), // marker
      w({ id: 3, status: 'IN_CERTIFICATION', seal: 'YELLOW', publicId: null }), // marker
      w({ id: 4, status: 'IN_CERTIFICATION', seal: 'YELLOW', publicId: 'HA-4' }), // linked already: no marker
      w({ id: 5, status: 'LISTED' }), // already on sale
      w({ id: 6, status: 'AUTHENTICATED', seal: 'YELLOW' }), // no green seal
    ])
    expect(s.text).toBe('6 obras selecionadas')
    expect(s.markers).toBe(2)
    expect(s.listable.map((x) => x.id)).toEqual([1])
    expect(s.notListable).toBe(5)
  })
  it('wording', () => {
    expect(selectionText(1)).toBe('1 obra selecionada')
    expect(needsMarker({ status: 'SOLD', publicId: null })).toBe(false)
    expect(canList({ status: 'AUTHENTICATED', seal: 'NONE' })).toBe(false)
    expect(batchResultText(3, 0)).toBe('3 obras listadas')
    expect(batchResultText(1, 1)).toBe('1 obra listada · 1 não foi')
    expect(batchResultText(0, 2)).toBe('0 obras listadas · 2 não foram')
  })
})

describe('reaisToCents', () => {
  it('reads reais typed by hand', () => {
    expect(reaisToCents('12.500')).toBe(1_250_000n)
    expect(reaisToCents('R$ 300')).toBe(30_000n)
    expect(reaisToCents('')).toBeNull()
    expect(reaisToCents('0')).toBeNull()
  })
})

describe('batchPayload', () => {
  const titles = new Map([[1, 'Noite'], [2, 'Dia']])
  const shared = { fixedPrice: false, autoNegotiatorOn: true, autoAcceptMin: '92' }
  it('builds one body per work, strings for the cents', () => {
    const r = batchPayload([{ id: 1, listPrice: '10.000', reservePrice: '9.000' }, { id: 2, listPrice: '500', reservePrice: '400' }], shared, titles)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toEqual([
      { id: 1, body: { listPriceCents: '1000000', reservePriceCents: '900000', autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false } },
      { id: 2, body: { listPriceCents: '50000', reservePriceCents: '40000', autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false } },
    ])
  })
  it('names the row with the problem and applies the mandate rules', () => {
    expect(batchPayload([{ id: 1, listPrice: '', reservePrice: '1' }], shared, titles)).toEqual({ ok: false, error: 'Informe o preço pedido de "Noite".' })
    expect(batchPayload([{ id: 2, listPrice: '100', reservePrice: '' }], shared, titles)).toEqual({ ok: false, error: 'Informe o piso de "Dia".' })
    expect(batchPayload([{ id: 2, listPrice: '100', reservePrice: '200' }], shared, titles)).toMatchObject({ ok: false, error: expect.stringContaining('"Dia": O piso não pode passar do preço pedido.') })
    expect(batchPayload([{ id: 2, listPrice: '100', reservePrice: '95' }], shared, titles)).toEqual({ ok: false, error: '"Dia": O mínimo do negociador não pode ficar abaixo do piso.' })
    expect(batchPayload([], shared, titles)).toEqual({ ok: false, error: 'Nenhuma obra para listar.' })
    expect(batchPayload([{ id: 1, listPrice: '100', reservePrice: '50' }], { ...shared, autoAcceptMin: '0' }, titles).ok).toBe(false)
  })
  it('fixed price turns the negotiator off and ignores the minimum', () => {
    const r = batchPayload([{ id: 1, listPrice: '100', reservePrice: '100' }], { fixedPrice: true, autoNegotiatorOn: true, autoAcceptMin: 'x' }, titles)
    expect(r.ok && r.items[0].body).toEqual({ listPriceCents: '10000', reservePriceCents: '10000', autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: true })
  })
})
