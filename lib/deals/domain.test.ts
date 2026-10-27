import { describe, expect, it } from 'vitest'
import { arrivingLabel, dealCode, nextPhase, progressPct } from './domain'

describe('deal phases', () => {
  it('advance in order and end at COMPLETED', () => {
    expect(nextPhase('OFFER_ACCEPTED')).toBe('ESCROW')
    expect(nextPhase('TRANSFER')).toBe('COMPLETED')
    expect(nextPhase('COMPLETED')).toBeNull()
    expect(progressPct('SHIPPING')).toBe(50)
    expect(dealCode(2026, 3)).toBe('DL-2026-000003')
  })
})

describe('arrivingLabel', () => {
  it('says where the purchase is, in transit included', () => {
    expect(arrivingLabel('OFFER_ACCEPTED')).toBe('Reservada · aguardando pagamento')
    expect(arrivingLabel('SHIPPING')).toBe('Chegando · em trânsito')
    expect(arrivingLabel('DELIVERY')).toBe('Chegando · escritura em emissão')
    expect(arrivingLabel('COMPLETED')).toBeNull()
  })
})
