import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES, helpArticle } from './help-content'

describe('Central de Ajuda', () => {
  it('six articles with unique slugs, each with a body', () => {
    expect(HELP_ARTICLES).toHaveLength(6)
    expect(new Set(HELP_ARTICLES.map((a) => a.slug)).size).toBe(6)
    for (const a of HELP_ARTICLES) { expect(a.blocks.length).toBeGreaterThan(2); expect(a.slug).toMatch(/^[a-z-]+$/) }
    expect(helpArticle('etiqueta')?.title).toContain('Etiqueta')
    expect(helpArticle('nope')).toBeNull()
  })
  it('never talks of bids or the floor; an auction only to say there is none', () => {
    const text = JSON.stringify(HELP_ARTICLES).toLowerCase()
    for (const word of ['lance', 'piso', 'preço mínimo', 'ranking']) expect(text).not.toContain(word)
    // "leilão" appears only to say there is none
    expect(text.split('leilão').length - 1).toBe((text.match(/não há leilão/g) ?? []).length)
  })
})
