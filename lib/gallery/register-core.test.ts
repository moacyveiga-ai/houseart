import { describe, expect, it } from 'vitest'
import { artistOptionsOf, GALLERY_REGISTER_STEPS } from './register-core'
import { isSecondaryOrigin } from '@/lib/artworks/domain'

describe('gallery register core', () => {
  it('five steps, the first asks where the artwork comes from', () => {
    expect(GALLERY_REGISTER_STEPS.map((s) => s.key)).toEqual(['origin', 'artist', 'photos', 'sheet', 'review'])
    expect(GALLERY_REGISTER_STEPS[0]!.title).toBe('De onde vem esta obra?')
  })
  it('represented artists as suggestions', () => {
    expect(artistOptionsOf([{ id: 1, name: 'Nina', contract: { kindLabel: 'Consignação' }, hasAccount: true }, { id: 2, name: 'Tomás', contract: null, hasAccount: false }]))
      .toEqual([{ id: 1, name: 'Nina', sub: 'Consignação · na HouseArt' }, { id: 2, name: 'Tomás', sub: 'Sem contrato · sem conta' }])
  })
  it('market by origin: the collector\'s and the gallery\'s resale are secondary; consignment and own stock are first sales', () => {
    expect(isSecondaryOrigin(null)).toBe(false)
    expect(isSecondaryOrigin('BOUGHT_OUTSIDE')).toBe(true)
    expect(isSecondaryOrigin('COLLECTOR_RESALE')).toBe(true)
    expect(isSecondaryOrigin('CONSIGNMENT')).toBe(false)
    expect(isSecondaryOrigin('OWN_STOCK')).toBe(false)
    expect(isSecondaryOrigin('OTHER')).toBe(false)
  })
})
