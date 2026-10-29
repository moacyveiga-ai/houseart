import { describe, expect, it } from 'vitest'
import { pickSignupPlan, type SignupPlan } from './signup-plans'

const plan = (code: string, profileKind: SignupPlan['profileKind']): SignupPlan => ({ code, name: code, short: code, price: 'R$ 0', per: '', note: '', cta: '', profileKind })

describe('pickSignupPlan', () => {
  const gallery = plan('GALLERY_PRO', 'GALLERY')
  const free = plan('ARTIST_FREE', 'ARTIST')
  const studio = plan('ARTIST_STUDIO', 'ARTIST')
  it('the plan asked for, else the default', () => {
    expect(pickSignupPlan([gallery, free, studio], 'GALLERY_PRO')?.code).toBe('GALLERY_PRO')
    expect(pickSignupPlan([gallery, free, studio], undefined)?.code).toBe('ARTIST_STUDIO')
    expect(pickSignupPlan([gallery, free, studio], 'NOPE')?.code).toBe('ARTIST_STUDIO')
  })
  it('with the default switched off, an artist plan still on — never the gallery plan by order', () => {
    expect(pickSignupPlan([gallery, free], undefined)?.code).toBe('ARTIST_FREE')
    expect(pickSignupPlan([gallery], undefined)?.code).toBe('GALLERY_PRO')
    expect(pickSignupPlan([], undefined)).toBeNull()
  })
})
