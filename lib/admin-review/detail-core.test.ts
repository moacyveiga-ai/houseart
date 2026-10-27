import { describe, expect, it } from 'vitest'
import { certificateLine, CONTEXT_TITLES, similarityLabel } from './detail-core'
import { REVIEW_KINDS } from './core'

describe('review detail core', () => {
  it('similarity in whole percent, clamped', () => {
    expect(similarityLabel(9_140)).toBe('91% semelhante')
    expect(similarityLabel(12_000)).toBe('100% semelhante')
    expect(similarityLabel(-5)).toBe('0% semelhante')
  })
  it('certificate line', () => {
    expect(certificateLine(null)).toBe('Sem certificado')
    expect(certificateLine({ status: 'ACTIVE', signedOn: '12/10', issuedOn: '13/10' })).toBe('Ativo · assinado 12/10 · emitido 13/10')
    expect(certificateLine({ status: 'DRAFT', signedOn: null, issuedOn: null })).toBe('Em preparo · não assinado')
  })
  it('every kind has a context title', () => {
    for (const k of REVIEW_KINDS) expect(CONTEXT_TITLES[k]).toBeTruthy()
  })
})
