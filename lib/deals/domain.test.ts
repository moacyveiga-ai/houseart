import { describe, expect, it } from 'vitest'
import { arrivingLabel, dealCode, inCourseForBuyer, nextPhase, progressPct } from './domain'

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
    expect(arrivingLabel('DELIVERY')).toBe('Entregue · escritura pendente')
    expect(arrivingLabel('SHIPPING', 'DISPUTE')).toBe('Em análise pela HouseArt')
    expect(arrivingLabel('SHIPPING', 'CANCELLED')).toBeNull()
    expect(arrivingLabel('COMPLETED')).toBeNull()
  })
})

describe('inCourseForBuyer', () => {
  it('counts a deal in course and a dispute; never a completed or cancelled one', () => {
    expect(inCourseForBuyer('SHIPPING', null)).toBe(true)
    expect(inCourseForBuyer('ESCROW', 'DISPUTE')).toBe(true)
    expect(inCourseForBuyer('ESCROW', 'CANCELLED')).toBe(false)
    expect(inCourseForBuyer('COMPLETED', null)).toBe(false)
  })
})
