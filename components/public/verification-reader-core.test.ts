import { describe, expect, it } from 'vitest'
import { outcomeIcon, outcomeOf, readerSubtitle, readerTitle, READING_MS, RESULT_MS } from './verification-reader-core'

describe('verification reader overlay', () => {
  it('phases last what the prototype lasts (1,6 s + 0,9 s = 2,5 s)', () => {
    expect(READING_MS + RESULT_MS).toBe(2500)
  })
  it('valid read of an authenticated work is ok; of a contested one is attention', () => {
    expect(outcomeOf('valid', 'authenticated')).toBe('ok')
    expect(outcomeOf('valid', 'contested')).toBe('attention')
    expect(outcomeOf('valid', 'stolen')).toBe('attention')
  })
  it('tamper always fails, unverified is attention whatever the verdict', () => {
    expect(outcomeOf('tamper', 'authenticated')).toBe('failed')
    expect(outcomeOf('unverified', 'authenticated')).toBe('attention')
  })
  it('titles and subtitles follow the phase and the result', () => {
    expect(readerTitle('reading', 'valid', 'authenticated')).toBe('Lendo a etiqueta')
    expect(readerTitle('result', 'valid', 'authenticated')).toBe('Etiqueta válida')
    expect(readerTitle('result', 'valid', 'stolen')).toBe('Atenção')
    expect(readerTitle('result', 'tamper', 'authenticated')).toBe('Etiqueta não confirmada')
    expect(readerSubtitle('reading', 'valid')).toMatch(/encostado/)
    expect(readerSubtitle('result', 'valid')).toBe('Abrindo o certificado…')
    expect(readerSubtitle('result', 'tamper')).toMatch(/violação/)
  })
  it('icons per outcome', () => {
    expect(outcomeIcon('ok')).toBe('check')
    expect(outcomeIcon('attention')).toBe('priority_high')
    expect(outcomeIcon('failed')).toBe('link_off')
  })
})
