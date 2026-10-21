import { describe, expect, it } from 'vitest'
import { decryptText, documentSearchHash, encryptText, hashDocument, protectDocument } from './cipher'
import { isCnpj, isCpf, maskDocument, maskDocumentInput } from './document'

describe('document', () => {
  it('validates CPF and CNPJ', () => {
    expect(isCpf('52998224725')).toBe(true)
    expect(isCpf('11111111111')).toBe(false)
    expect(isCnpj('11222333000181')).toBe(true)
    expect(isCnpj('11222333000182')).toBe(false)
  })
  it('masks', () => {
    expect(maskDocument('52998224725')).toBe('***.***.***-25')
    expect(maskDocumentInput('11222333000181')).toBe('11.222.333/0001-81')
  })
})

describe('cipher', () => {
  it('round trips and hashes deterministically', () => {
    const enc = encryptText('52998224725')
    expect(decryptText(enc)).toBe('52998224725')
    expect(hashDocument('52998224725')).toBe(hashDocument('52998224725'))
    expect(enc).not.toContain('52998224725')
  })
  it('protectDocument validates and never leaks', () => {
    const p = protectDocument('529.982.247-25')
    expect(p.type).toBe('CPF')
    expect(p.mask).toBe('***.***.***-25')
    expect(p.hash).toBe(documentSearchHash('52998224725'))
    expect(() => protectDocument('123')).toThrow('CPF/CNPJ inválido')
  })
})
