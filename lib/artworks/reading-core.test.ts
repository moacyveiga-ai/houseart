import { describe, expect, it } from 'vitest'
import { applyReading, parseReading, readingToast, userPromptFor } from './reading-core'

describe('reading core', () => {
  it('parses a fenced JSON and coerces the year', () => {
    const r = parseReading('```json\n{"artistName":"J. Teixeira","title":"Maré","year":"2022","technique":"Têmpera sobre tela","signatureText":"J. Teixeira 22","bogus":1}\n```')
    expect(r).toMatchObject({ artistName: 'J. Teixeira', title: 'Maré', year: 2022, technique: 'Têmpera sobre tela', signatureText: 'J. Teixeira 22' })
    expect('bogus' in r).toBe(false)
    expect(parseReading('nada').year).toBeUndefined()
    expect(parseReading('{"year": 3000}').year).toBeNull()
  })
  it('fills only empty fields', () => {
    const sheet = { title: 'Já tenho', year: null, technique: '', materials: null, edition: null, signatureLocation: null }
    const { patch, filled } = applyReading(sheet, { title: 'Outro', year: 2020, technique: 'Óleo', edition: null, signatureLocation: 'Frente · inferior direita' })
    expect(patch).toEqual({ year: 2020, technique: 'Óleo', signatureLocation: 'Frente · inferior direita' })
    expect(filled).toEqual(['year', 'technique', 'signatureLocation'])
  })
  it('toast and prompt', () => {
    expect(readingToast({ signatureText: 'J. T. 22' }, [])).toBe('Assinatura reconhecida: J. T. 22')
    expect(readingToast({}, ['year'])).toBe('Sugestões aplicadas · confira os campos')
    expect(readingToast({}, [])).toBe('Nada legível nas fotos · preencha à mão')
    expect(userPromptFor(['FRONT_COLOR_CARD', 'BACK'])).toContain('frente com cartão de cor, verso')
  })
})
