import { describe, expect, it } from 'vitest'
import { ABOUT_MAX, cleanAbout } from './core'

describe('cleanAbout', () => {
  it('trims, collapses spaces, clears on empty and refuses contacts or long text', () => {
    expect(cleanAbout('  Coleciono   gravura  ')).toEqual({ ok: true, value: 'Coleciono gravura' })
    expect(cleanAbout('   ')).toEqual({ ok: true, value: '' })
    expect(cleanAbout('x'.repeat(ABOUT_MAX + 1)).ok).toBe(false)
    expect(cleanAbout('me chama no 71 99999-1234').ok).toBe(false)
  })
})
