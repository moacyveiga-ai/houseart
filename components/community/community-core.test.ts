import { describe, expect, it } from 'vitest'
import { panelNewsHref } from './community-core'

describe('panelNewsHref', () => {
  it('maps a public news link into the panel and keeps anything else', () => {
    expect(panelNewsHref('/e/news/colecionadores-jovens')).toBe('/community/news/colecionadores-jovens')
    expect(panelNewsHref('/e/guide')).toBe('/e/guide')
    expect(panelNewsHref('/e/news/../x')).toBe('/e/news/../x')
    expect(panelNewsHref(null)).toBeNull()
  })
})
