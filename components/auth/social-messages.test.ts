import { describe, expect, it } from 'vitest'
import { SOCIAL_BUTTONS, socialMessage, socialStartHref } from './social-messages'

describe('social login messages and links', () => {
  it('maps every code the callback emits to a pt-BR sentence', () => {
    for (const code of ['state', 'denied', 'failed', 'no-email', 'inactive', 'provider']) expect(socialMessage(code)).toBeTruthy()
    expect(socialMessage('state')).toBe('A sessão do login social expirou. Tente de novo.')
    expect(socialMessage('no-email')).toBe('O provedor não informou um e-mail. Use outro meio.')
  })

  it('shows nothing for an unknown or absent code', () => {
    expect(socialMessage(null)).toBeNull()
    expect(socialMessage(undefined)).toBeNull()
    expect(socialMessage('whatever')).toBeNull()
  })

  it('builds the start link with purpose and next', () => {
    expect(socialStartHref('google', 'login', null)).toBe('/api/auth/oauth/google/start?purpose=login')
    expect(socialStartHref('apple', 'login', '/profiles')).toBe('/api/auth/oauth/apple/start?purpose=login&next=%2Fprofiles')
  })

  it('lists the four providers of the handoff, in order', () => {
    expect(SOCIAL_BUTTONS.map((b) => b.slug)).toEqual(['google', 'apple', 'facebook', 'linkedin'])
  })
})
