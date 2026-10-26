import { describe, expect, it } from 'vitest'
import { categoryOfTechnique, cmOf, dimensionsLabel, editionChipOf, REGISTER_STEPS, resumeStep, sheetMessage, sheetProblems, signatureChipOf, supportChipOf, techniqueChipOf, yearOf, yearPatch } from './register-core'

describe('cadastro de obra do colecionador', () => {
  it('has the five steps of the prototype', () => {
    expect(REGISTER_STEPS.map((s) => s.key)).toEqual(['origin', 'artist', 'photos', 'sheet', 'review'])
  })
  it('asks for title, technique and both dimensions', () => {
    expect(sheetProblems({ title: '', technique: null, heightCm: '', widthCm: '10' })).toEqual(['o título', 'a técnica', 'altura e largura'])
    expect(sheetProblems({ title: 'Mar', technique: 'Pintura', heightCm: '120,5', widthCm: '90' })).toEqual([])
    expect(sheetProblems({ title: 'Mar', technique: 'Pintura', heightCm: '0', widthCm: '90' })).toEqual(['altura e largura'])
    expect(sheetMessage(['o título', 'a técnica'])).toBe('Preencha o título e a técnica.')
    expect(sheetMessage([])).toBe('')
  })
  it('derives the category from the technique chip', () => {
    expect(categoryOfTechnique('Gravura')).toBe('WORK_ON_PAPER')
    expect(categoryOfTechnique('Óleo sobre tela')).toBeUndefined()
  })
  it('formats centimeters from millimeters', () => {
    expect(dimensionsLabel(1205, 900, 40)).toBe('120,5 × 90 × 4 cm')
    expect(dimensionsLabel(1200, null, null)).toBeNull()
    expect(cmOf(1205)).toBe('120,5')
    expect(cmOf(null)).toBe('')
  })
  it('resumes at the photos until the front exists', () => {
    expect(resumeStep(false)).toBe(2)
    expect(resumeStep(true)).toBe(3)
    expect(resumeStep(true, true)).toBe(4)
    expect(resumeStep(false, true)).toBe(2)
  })
  it('brings what the photo reading wrote to the chips', () => {
    expect(techniqueChipOf('Óleo sobre tela')).toBe('Pintura')
    expect(techniqueChipOf('Xilogravura')).toBe('Gravura')
    expect(techniqueChipOf('Técnica mista sobre papel')).toBe('Técnica mista')
    expect(techniqueChipOf('algo estranho')).toBeNull()
    expect(supportChipOf('Tela de algodão')).toBe('Tela')
    expect(supportChipOf('vidro')).toBe('Outro')
    expect(editionChipOf('12/30')).toBe('Múltiplo / tiragem')
    expect(editionChipOf('P.A.')).toBe('Prova de artista')
    expect(editionChipOf('Única')).toBe('Única')
    expect(signatureChipOf('canto inferior direito')).toBe('Frente · inferior direita')
    expect(signatureChipOf('No verso')).toBe('Verso')
  })
  it('never erases a saved year with a half-typed one', () => {
    expect(yearOf('1998')).toBe(1998)
    expect(yearOf('199')).toBeNull()
    expect(yearPatch('')).toBeNull()
    expect(yearPatch('199')).toBeUndefined()
    expect(yearPatch('2019')).toBe(2019)
  })
  it('the default draft title is no title', () => {
    expect(sheetProblems({ title: 'Nova obra', technique: 'Pintura', heightCm: '10', widthCm: '10' })).toEqual(['o título'])
  })
})
