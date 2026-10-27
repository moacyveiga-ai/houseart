import { describe, expect, it } from 'vitest'
import { formatPhoneInput, maskPhone, normalizeBrMobile, tidyPhone } from './core'

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

describe('tidyPhone', () => {
  it('formats a plain landline or mobile and leaves everything else as typed', () => {
    expect(tidyPhone('7133330000')).toBe('(71) 3333-0000')
    expect(tidyPhone('71 99999.0000')).toBe('(71) 99999-0000')
    expect(tidyPhone('(71) 3333-0000 r. 12')).toBe('(71) 3333-0000 r. 12')
    expect(tidyPhone('0800 722 1234')).toBe('0800 722 1234')
    expect(tidyPhone('55 71 3333-0000')).toBe('55 71 3333-0000')
    expect(tidyPhone('4004-1234')).toBe('4004-1234')
    expect(tidyPhone('+44 20 7946 0000')).toBe('+44 20 7946 0000')
    expect(tidyPhone('')).toBe('')
  })
})
