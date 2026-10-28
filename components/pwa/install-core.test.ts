import { describe, expect, it } from 'vitest'
import { INSTALL_STEPS, platformOf } from './install-core'

describe('platformOf', () => {
  it('reads the device from the user agent', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBe('ios')
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('ios')
    expect(platformOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile')).toBe('android')
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('desktop')
  })
  it('has three steps for every platform', () => {
    for (const steps of Object.values(INSTALL_STEPS)) expect(steps).toHaveLength(3)
  })
})
