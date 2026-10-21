import { describe, expect, it } from 'vitest'
import { hasTotalScope, isInternal, knownProfile, PROFILES, profileLevel } from './profiles'

describe('profiles', () => {
  it('staff has total scope; member is internal but scoped; collector is external', () => {
    expect(hasTotalScope('admin')).toBe(true)
    expect(hasTotalScope('member')).toBe(false)
    expect(isInternal('member')).toBe(true)
    expect(isInternal('collector')).toBe(true)
    expect(isInternal('institution')).toBe(false)
    expect(isInternal({ profile: 'operator' })).toBe(true)
  })
  it('unknown profile fails closed', () => {
    expect(knownProfile('wizard')).toBe('institution')
    expect(isInternal(knownProfile('wizard'))).toBe(false)
    expect(profileLevel('admin')).toBeGreaterThan(profileLevel('manager'))
    expect(PROFILES).toHaveLength(8)
  })
})
