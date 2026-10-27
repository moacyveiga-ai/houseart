import { describe, expect, it } from 'vitest'
import { formatAnyPhoneInput, formatPhoneInput, maskPhone, normalizeBrMobile } from './core'

describe('sms core', () => {
  it('normalizes a Brazilian mobile to E.164', () => {
    expect(normalizeBrMobile('(71) 99999-0000')).toBe('+5571999990000')
    expect(normalizeBrMobile('+55 71 99999 0000')).toBe('+5571999990000')
    expect(normalizeBrMobile('71 3333-0000')).toBeNull()
    expect(normalizeBrMobile('999990000')).toBeNull()
  })
  it('masks and formats', () => {
    expect(maskPhone('+5571999990000')).toBe('(71) 99999-0000')
    expect(formatPhoneInput('7199')).toBe('(71) 99')
    expect(formatPhoneInput('71999990000')).toBe('(71) 99999-0000')
  })
})

describe('formatAnyPhoneInput', () => {
  it('landline, mobile and abroad', () => {
    expect(formatAnyPhoneInput('7133330000')).toBe('(71) 3333-0000')
    expect(formatAnyPhoneInput('71999990000')).toBe('(71) 99999-0000')
    expect(formatAnyPhoneInput('713')).toBe('(71) 3')
    expect(formatAnyPhoneInput('+44 20 7946 0000')).toBe('+44 20 7946 0000')
    expect(formatAnyPhoneInput('')).toBe('')
  })
})
