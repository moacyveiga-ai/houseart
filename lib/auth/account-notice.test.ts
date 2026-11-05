import { describe, expect, it } from 'vitest'
import { accountExistsNotice } from './access-code-core'

describe('accountExistsNotice', () => {
  it('points to login and password recovery, never says who tried', () => {
    const m = accountExistsNotice('https://www.houseart.com.br/')
    expect(m.subject).toBe('Você já tem conta na HouseArt')
    expect(m.text).toContain('https://www.houseart.com.br/login')
    expect(m.text).toContain('https://www.houseart.com.br/recover-password')
    expect(m.text).not.toMatch(/código/i)
  })
})
