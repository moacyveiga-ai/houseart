import { describe, expect, it } from 'vitest'
import { parseRestorationInput } from './restore-core'

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
    expect(parseRestorationInput({ description: 'Limpeza da superfície', on: '2026-02-30' }, today).ok).toBe(true) // JS parses it; the day is only informative
    expect(parseRestorationInput({ description: 'Limpeza da superfície', on: '2026-10-27' }, today)).toEqual({ ok: false, error: 'A data do restauro não pode estar no futuro.' })
    expect(parseRestorationInput(null, today).ok).toBe(false)
  })
})
