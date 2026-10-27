import { describe, expect, it } from 'vitest'
import { accountShapeOf } from './account-core'

const hrefs = (p: Parameters<typeof accountShapeOf>[0]) => accountShapeOf(p).work?.items.map((i) => i.href) ?? []

describe('account by profile', () => {
  it('the collector keeps the collection, cards and Pix', () => {
    expect(hrefs('collector')).toContain('/wallet/register')
    expect(accountShapeOf('collector')).toMatchObject({ payments: true, payout: true, social: true })
  })
  it('the artist never meets the collector register (403 for an artist member)', () => {
    expect(hrefs('artist')).not.toContain('/wallet/register')
    expect(hrefs('artist')).not.toContain('/wallet')
    expect(hrefs('artist')).toEqual(expect.arrayContaining(['/artworks', '/artworks/new', '/certification', '/sales', '/profile/public']))
  })
  it('appraiser and admin see their desk, no wallet, Pix nor Instagram', () => {
    for (const p of ['appraiser', 'admin'] as const) {
      expect(accountShapeOf(p)).toMatchObject({ payments: false, payout: false, social: false })
      expect(hrefs(p).some((h) => h.startsWith('/wallet'))).toBe(false)
    }
    expect(hrefs('admin')).toContain('/admin/review')
    expect(hrefs('appraiser')).toEqual(['/appraisals'])
  })
  it('gallery and advisor have no work block here (their account is /gallery/account)', () => {
    expect(accountShapeOf('gallery').work).toBeNull()
    expect(accountShapeOf('advisor').payout).toBe(false)
  })
})
