import { describe, expect, it } from 'vitest'
import { canRecordPackaging, conditionReportOf, packagingPhotoUrl } from './packaging-core'

describe('packaging', () => {
  it('only between the escrow and the shipment, never with an exception', () => {
    expect(canRecordPackaging('OFFER_ACCEPTED', null)).toBe(false)
    expect(canRecordPackaging('ESCROW', null)).toBe(true)
    expect(canRecordPackaging('DOCUMENTS', null)).toBe(true)
    expect(canRecordPackaging('SHIPPING', null)).toBe(false)
    expect(canRecordPackaging('DOCUMENTS', 'CANCELLED')).toBe(false)
  })
  it('validates the condition note', () => {
    expect(conditionReportOf('  curto ').ok).toBe(false)
    expect(conditionReportOf('x'.repeat(1001)).ok).toBe(false)
    expect(conditionReportOf(42).ok).toBe(false)
    expect(conditionReportOf('  Tela íntegra, sem craquelê.  ')).toEqual({ ok: true, text: 'Tela íntegra, sem craquelê.' })
  })
  it('photo url', () => expect(packagingPhotoUrl(3, 9)).toBe('/api/deals/3/packaging/photos/9'))
})
