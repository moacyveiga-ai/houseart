import { describe, expect, it } from 'vitest'
import { isCalendarDay, parseRestorationInput, restorationBlockReason } from './restore-core'

describe('parseRestorationInput', () => {
  const today = '2026-10-26'
  it('accepts a described restoration, trims and caps the restorer, keeps the day', () => {
    expect(parseRestorationInput({ description: '  Limpeza da  superfície e reentelamento ', restorer: ' Ateliê  Lima ', on: '2026-09-30' }, today))
      .toEqual({ ok: true, value: { description: 'Limpeza da superfície e reentelamento', restorer: 'Ateliê Lima', on: '2026-09-30' } })
    expect(parseRestorationInput({ description: 'Verniz refeito em 2025' }, today)).toEqual({ ok: true, value: { description: 'Verniz refeito em 2025', restorer: null, on: null } })
  })
  it('refuses a short or too long description, a bad or future date', () => {
    expect(parseRestorationInput({ description: 'curta' }, today).ok).toBe(false)
    expect(parseRestorationInput({ description: 'x'.repeat(501) }, today).ok).toBe(false)
    expect(parseRestorationInput({ description: 'Limpeza da superfície', on: '30/09/2026' }, today)).toEqual({ ok: false, error: 'Data inválida.' })
    expect(parseRestorationInput({ description: 'Limpeza da superfície', on: '2026-02-30' }, today)).toEqual({ ok: false, error: 'Data inválida.' })
    expect(parseRestorationInput({ description: 'Limpeza da superfície', on: '2026-10-27' }, today)).toEqual({ ok: false, error: 'A data do restauro não pode estar no futuro.' })
    expect(parseRestorationInput(null, today).ok).toBe(false)
  })
  it('only real calendar days (the chain never forgets a 30 de fevereiro)', () => {
    expect(isCalendarDay('2024-02-29')).toBe(true)
    expect(isCalendarDay('2026-02-29')).toBe(false)
    expect(isCalendarDay('2026-04-31')).toBe(false)
    expect(isCalendarDay('2026-13-01')).toBe(false)
  })
  it('blocks the record while stolen, disputed, in a deal or with the certificate not active', () => {
    expect(restorationBlockReason('AUTHENTICATED', 'ACTIVE')).toBeNull()
    expect(restorationBlockReason('LISTED', 'ACTIVE')).toBeNull()
    expect(restorationBlockReason('IN_DEAL', 'ACTIVE')).toMatch(/em venda/)
    expect(restorationBlockReason('STOLEN', 'ACTIVE')).toMatch(/furto/)
    expect(restorationBlockReason('DISPUTED', 'ACTIVE')).toMatch(/contestação/)
    expect(restorationBlockReason('AUTHENTICATED', 'REVOKED')).toMatch(/não está ativo/)
    expect(restorationBlockReason('AUTHENTICATED', null)).toMatch(/não está ativo/)
  })
})
