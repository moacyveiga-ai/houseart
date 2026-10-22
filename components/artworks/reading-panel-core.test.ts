import { describe, expect, it } from 'vitest'
import { fieldsToHighlight, patchFromReading, readingPanelState, stateFromError, stateFromResponse } from './reading-panel-core'

describe('readingPanelState', () => {
  it('idle shows the prototype title and subtitle', () => {
    const s = readingPanelState({ phase: 'idle' })
    expect(s.title).toBe('Preencher com as fotos')
    expect(s.subtitle).toMatch(/Lemos assinatura/)
    expect(s.busy).toBe(false)
  })
  it('reading is busy with "Lendo as fotos…"', () => {
    expect(readingPanelState({ phase: 'reading' })).toMatchObject({ title: 'Lendo as fotos…', busy: true })
  })
  it('applied changes the title to the cbIATit of the prototype', () => {
    expect(readingPanelState({ phase: 'applied', note: 'Confira o ano.' })).toMatchObject({ title: 'Sugestões aplicadas · confira os campos', note: 'Confira o ano.' })
  })
})

describe('stateFromResponse', () => {
  it('mock mode: the API message, nothing highlighted, no toast', () => {
    const r = stateFromResponse({ mode: 'mock', applied: {}, filled: [], toast: 'Leitura automática desligada neste ambiente · preencha à mão' })
    expect(r.state.phase).toBe('off')
    expect(r.state.message).toBe('Leitura automática desligada neste ambiente · preencha à mão')
    expect(r.highlight).toEqual([])
    expect(r.toast).toBeNull()
  })
  it('claude with fields filled: applied, highlights only wizard fields, patch typed', () => {
    const r = stateFromResponse({ mode: 'claude', applied: { title: 'Maré', year: 2022, technique: 'Óleo sobre tela', bogus: 'x' }, filled: ['title', 'year', 'technique', 'artistName'], toast: 'Assinatura reconhecida: J. Teixeira, 2022', suggestions: { notes: 'Medidas não lidas.' } })
    expect(r.state.title).toBe('Sugestões aplicadas · confira os campos')
    expect(r.state.note).toBe('Medidas não lidas.')
    expect(r.highlight).toEqual(['title', 'year', 'technique'])
    expect(r.toast).toBe('Assinatura reconhecida: J. Teixeira, 2022')
    expect(r.patch).toEqual({ title: 'Maré', year: 2022, technique: 'Óleo sobre tela' })
  })
  it('claude with nothing filled: the API toast as message', () => {
    const r = stateFromResponse({ mode: 'claude', applied: {}, filled: [], toast: 'Nada legível nas fotos · preencha à mão' })
    expect(r.state.phase).toBe('off')
    expect(r.state.message).toBe('Nada legível nas fotos · preencha à mão')
  })
})

describe('stateFromError', () => {
  it('uses the API error text (422 without the front photo)', () => {
    expect(stateFromError(422, { error: 'Envie ao menos a foto da frente para ler.' }).message).toBe('Envie ao menos a foto da frente para ler.')
  })
  it('falls back without inventing a cause', () => {
    expect(stateFromError(500, {}).message).toBe('Não foi possível ler as fotos agora.')
    expect(stateFromError(0, null).message).toBe('Sem conexão. Tente de novo.')
  })
})

describe('helpers', () => {
  it('fieldsToHighlight drops unknown fields', () => {
    expect(fieldsToHighlight(['title', 'artistName', 'x'])).toEqual(['title'])
    expect(fieldsToHighlight(undefined)).toEqual([])
  })
  it('patchFromReading keeps only typed values', () => {
    expect(patchFromReading({ year: '2020', title: 5, edition: null, materials: 'Tela' })).toEqual({ edition: null, materials: 'Tela' })
  })
})
