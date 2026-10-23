import { describe, expect, it } from 'vitest'
import { isSellerRole, sellerPermissions } from './seller-role-core'

describe('sellerPermissions', () => {
  it('admin and people outside a gallery team do everything', () => {
    for (const r of ['ADMIN', null] as const) expect(sellerPermissions(r)).toEqual({ answerOffers: true, manageListing: true, manageRules: true, manageTeam: true })
  })
  it('Vendas answers offers and manages the listing, not the rules nor the team', () => {
    expect(sellerPermissions('SALES')).toEqual({ answerOffers: true, manageListing: true, manageRules: false, manageTeam: false })
  })
  it('Acervo only registers and certifies', () => {
    expect(sellerPermissions('INVENTORY')).toEqual({ answerOffers: false, manageListing: false, manageRules: false, manageTeam: false })
  })
  it('isSellerRole is an allowlist', () => {
    expect(isSellerRole('SALES')).toBe(true)
    expect(isSellerRole('sales')).toBe(false)
    expect(isSellerRole(null)).toBe(false)
  })
})
