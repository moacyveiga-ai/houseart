import { describe, expect, it } from 'vitest'
import { mediaSummary, nextLabel, reviewLines, sheetPatch, type WizardState } from './wizard-core'

const s: WizardState = {
  title: 'Maré de março', year: 2026, technique: 'Têmpera sobre tela', materials: null, heightMm: 900, widthMm: 900, depthMm: 35,
  edition: 'Obra única', signatureLocation: null, series: null, conditionGrade: 'EXCELLENT', saleMode: 'FIXED_WITH_OFFERS', listPriceCents: 2_100_000,
  media: [{ id: 1, kind: 'FRONT_COLOR_CARD', publicUrl: null, quality: 'GOOD' }, { id: 2, kind: 'BACK', publicUrl: null, quality: 'GOOD' }],
  conditionRegions: [{ region: 'TOP_RIGHT', note: 'x', state: 'ATTENTION' }], historyItems: [],
}

describe('wizard core', () => {
  it('review lines follow the design', () => {
    expect(reviewLines(s).map((l) => `${l.k}: ${l.v}`)).toEqual([
      'Título: Maré de março, 2026', 'Técnica: Têmpera sobre tela', 'Dimensões: 90 × 90 × 3,5 cm', 'Edição: Obra única',
      'Mídia: 2 de 6 fotos · 4 pendente(s)', 'Condition report: Excelente · 1 ponto(s) de atenção', 'Preço: R$\u00a021.000 · aceita ofertas',
    ])
    expect(nextLabel(5)).toBe('Enviar para certificação')
    expect(nextLabel(0)).toBe('Continuar')
    expect(mediaSummary([])).toBe('0 de 6 fotos · 6 pendente(s)')
  })
  it('sheetPatch sends cm', () => {
    expect(sheetPatch(s)).toMatchObject({ heightMm: 90, depthMm: 3.5 })
  })
})
