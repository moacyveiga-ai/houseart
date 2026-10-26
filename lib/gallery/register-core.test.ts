import { describe, expect, it } from 'vitest'
import { artistOptionsOf, GALLERY_REGISTER_STEPS } from './register-core'

describe('gallery register core', () => {
  it('five steps, the first asks where the artwork comes from', () => {
    expect(GALLERY_REGISTER_STEPS.map((s) => s.key)).toEqual(['origin', 'artist', 'photos', 'sheet', 'review'])
    expect(GALLERY_REGISTER_STEPS[0]!.title).toBe('De onde vem esta obra?')
  })
  it('represented artists as suggestions', () => {
    expect(artistOptionsOf([{ id: 1, name: 'Nina', contract: { kindLabel: 'Consignação' }, hasAccount: true }, { id: 2, name: 'Tomás', contract: null, hasAccount: false }]))
      .toEqual([{ id: 1, name: 'Nina', sub: 'Consignação · na HouseArt' }, { id: 2, name: 'Tomás', sub: 'Sem contrato · sem conta' }])
  })
})
