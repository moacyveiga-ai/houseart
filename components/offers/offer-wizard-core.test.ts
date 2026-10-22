import { describe, expect, it } from 'vitest'
import { canAdvance, chanceOf, clampOffer, messagePreview, minOfferCents, reviewRows, shortcutCents, typedCents } from './offer-wizard-core'
import { finalActions, responseOf, statusCard, timelineOf, type StatusOffer } from './offer-status-core'

const PRICE = 3_800_000 // R$ 38.000

describe('offer-wizard-core (handoff HouseArt Oferta)', () => {
  it('floors at 50 % of the list price, rounded to R$ 100, and never above the price', () => {
    expect(minOfferCents(PRICE)).toBe(1_900_000)
    expect(clampOffer(1_000, PRICE)).toBe(1_900_000)
    expect(clampOffer(9_999_999, PRICE)).toBe(PRICE)
    expect(clampOffer(3_412_345, PRICE)).toBe(3_410_000)
  })
  it('shortcuts are −5/−10/−15/−20 % rounded to R$ 100', () => {
    expect(shortcutCents(PRICE, 0.95)).toBe(3_610_000)
    expect(shortcutCents(PRICE, 0.9)).toBe(3_420_000)
    expect(shortcutCents(PRICE, 0.85)).toBe(3_230_000)
    expect(shortcutCents(PRICE, 0.8)).toBe(3_040_000)
  })
  it('typing reads whole reais and caps at the price', () => {
    expect(typedCents('34.000', PRICE)).toBe(3_400_000)
    expect(typedCents('99999', PRICE)).toBe(PRICE)
    expect(typedCents('', PRICE)).toBe(0)
  })
  it('the chance band is ≥90 % · ≥80 % · below', () => {
    expect(chanceOf(3_420_000, PRICE).tone).toBe('good')
    expect(chanceOf(3_230_000, PRICE).tone).toBe('fair')
    expect(chanceOf(3_000_000, PRICE).tone).toBe('low')
    expect(chanceOf(3_000_000, PRICE, 'PRIVATE').title).toContain('este vendedor')
  })
  it('gates: identity needs login + CPF + phone; card hold needs a card; review needs the acceptance', () => {
    const base = { identity: { cpfOk: true, phoneOk: true, emailOk: false }, accepted: false, guarantee: 'CARD_HOLD' as const, hasCard: false, loggedIn: true }
    expect(canAdvance(1, base)).toBe(true)
    expect(canAdvance(2, base)).toBe(true)
    expect(canAdvance(2, { ...base, loggedIn: false })).toBe(false)
    expect(canAdvance(2, { ...base, identity: { ...base.identity, phoneOk: false } })).toBe(false)
    expect(canAdvance(3, base)).toBe(false)
    expect(canAdvance(3, { ...base, hasCard: true })).toBe(true)
    expect(canAdvance(3, { ...base, guarantee: 'PIX_RESERVE' })).toBe(true)
    expect(canAdvance(4, base)).toBe(false)
    expect(canAdvance(4, { ...base, accepted: true })).toBe(true)
  })
  it('review rows quote 40 characters of the message and name the card', () => {
    expect(messagePreview('')).toBe('Sem mensagem')
    expect(messagePreview('a'.repeat(50))).toBe(`“${'a'.repeat(40)}…”`)
    const rows = reviewRows({ offerCents: 3_420_000, validityHours: 48, message: '', guarantee: 'CARD_HOLD', cardLabel: 'Visa final 4821' })
    expect(rows.map((r) => r.key)).toEqual(['Valor da oferta', 'Validade', 'Mensagem', 'Identidade', 'Garantia'])
    expect(rows[4].value).toBe('Pré-autorização no cartão · Visa final 4821')
    expect(rows[3].step).toBe(2)
  })
})

const offer = (over: Partial<StatusOffer>): StatusOffer => ({
  status: 'RECEIVED', canReply: false, canRetract: true, validityHours: 48, offeredCents: 3_400_000, currentCents: 3_400_000, listPriceCents: PRICE,
  rounds: [{ number: 1, author: 'BUYER', amountCents: 3_400_000, message: null, at: '2026-10-22T14:32:00Z' }],
  createdAt: '2026-10-22T14:32:00Z', expiresAt: '2026-10-24T14:32:00Z', counterCents: null, counterMessage: null, guaranteeMethod: 'CARD_HOLD', shippingCents: 68_000, insuranceCents: 42_000, ...over,
})

describe('offer-status-core (the "Enviada" step)', () => {
  it('maps the buyer-facing status to the prototype responses', () => {
    expect(responseOf(offer({}))).toBe('analise')
    expect(responseOf(offer({ status: 'NEGOTIATING', canReply: true, counterCents: 3_550_000 }))).toBe('contra')
    expect(responseOf(offer({ status: 'NEGOTIATING', canReply: false }))).toBe('aguardando')
    expect(responseOf(offer({ status: 'ACCEPTED' }))).toBe('aceita')
    expect(responseOf(offer({ status: 'ACCEPTED', rounds: [{ number: 1, author: 'BUYER', amountCents: 3_400_000, message: null, at: 'x' }, { number: 2, author: 'SELLER', amountCents: 3_550_000, message: null, at: 'y' }] }))).toBe('contra_aceita')
    expect(responseOf(offer({ status: 'REFUSED' }))).toBe('recusada')
    expect(responseOf(offer({ status: 'EXPIRED' }))).toBe('expirada')
    expect(responseOf(offer({ status: 'RETRACTED' }))).toBe('retirada')
  })
  it('the status card names the seller and the guarantee undone', () => {
    const c = statusCard(offer({ status: 'REFUSED' }), 'recusada', 'a Galeria Ladeira')
    expect(c.title).toBe('Oferta não aceita')
    expect(c.text).toContain('reserva no seu cartão')
    expect(statusCard(offer({}), 'analise', 'a Galeria Ladeira').text).toContain('A Galeria Ladeira tem até 48 horas')
  })
  it('the timeline marks the steps done by the response', () => {
    const t = timelineOf(offer({}), 'analise', { name: 'Galeria Ladeira', kind: 'GALLERY' })
    expect(t.map((x) => x.done)).toEqual([true, false, false, false])
    expect(t[1].sub).toBe('Galeria Ladeira foi notificada')
    const c = timelineOf(offer({ status: 'ACCEPTED' }), 'aceita', { name: 'Colecionador particular', kind: 'PRIVATE' })
    expect(c.map((x) => x.done)).toEqual([true, true, true, true])
    expect(c[1].name).toBe('Vendedor analisando')
  })
  it('final actions follow the response', () => {
    expect(finalActions(offer({ status: 'ACCEPTED' }), 'aceita', 'HA-1').map((a) => a.href)).toEqual(['/purchases', '/e/marketplace'])
    expect(finalActions(offer({}), 'analise', 'HA-1').map((a) => a.name)).toEqual(['Ver minhas compras', 'Cancelar oferta'])
    expect(finalActions(offer({ canRetract: false }), 'analise', 'HA-1').map((a) => a.name)).toEqual(['Ver minhas compras'])
    expect(finalActions(offer({ status: 'REFUSED' }), 'recusada', 'HA-1').map((a) => a.href)).toEqual(['/e/artwork/HA-1/offer', '/e/artwork/HA-1/buy'])
  })
})
