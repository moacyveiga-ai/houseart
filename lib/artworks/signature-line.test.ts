import { describe, expect, it } from 'vitest'
import { signatureLine } from './domain'

describe('signatureLine', () => {
  it('reads an unsigned work as unsigned', () => {
    expect(signatureLine('Sem assinatura aparente')).toBe('Sem assinatura')
    expect(signatureLine('Sem assinatura')).toBe('Sem assinatura')
    expect(signatureLine('Não assinada')).toBe('Sem assinatura')
  })
  it('names where the work is signed', () => {
    expect(signatureLine('Frente, canto inferior direito')).toBe('Assinada · frente, canto inferior direito')
    expect(signatureLine('  ')).toBeNull()
    expect(signatureLine(null)).toBeNull()
  })
})
