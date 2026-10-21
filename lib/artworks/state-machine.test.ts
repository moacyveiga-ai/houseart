import { describe, expect, it } from 'vitest'
import { canTransition, submitProblems } from './state-machine'

describe('artwork state machine', () => {
  it('LISTED needs the green seal', () => {
    expect(canTransition('AUTHENTICATED', 'LISTED', { seal: 'YELLOW' })).toEqual({ ok: false, reason: 'SEAL_REQUIRED' })
    expect(canTransition('AUTHENTICATED', 'LISTED', { seal: 'GREEN' })).toEqual({ ok: true })
    expect(canTransition('DRAFT', 'SOLD', { seal: 'GREEN' })).toEqual({ ok: false, reason: 'INVALID_TRANSITION' })
    expect(canTransition('IN_DEAL', 'LISTED', { seal: 'GREEN', hasLiveDeal: true })).toEqual({ ok: false, reason: 'LIVE_DEAL' })
  })
  it('submit requires title, artist, technique, front and back', () => {
    expect(submitProblems({ title: '', artistId: null, technique: null, mediaKinds: [] })).toHaveLength(5)
    expect(submitProblems({ title: 'x', artistId: 1, technique: 'Óleo', mediaKinds: ['FRONT_COLOR_CARD', 'BACK'] })).toEqual([])
  })
})
