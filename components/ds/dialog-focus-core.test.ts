import { describe, expect, it } from 'vitest'
import { trapTarget } from './dialog-focus-core'

describe('trapTarget', () => {
  it('wraps at both ends and leaves the middle to the browser', () => {
    expect(trapTarget(3, 2, false)).toBe(0)
    expect(trapTarget(3, 0, true)).toBe(2)
    expect(trapTarget(3, 1, false)).toBeNull()
    expect(trapTarget(3, 1, true)).toBeNull()
  })
  it('brings focus back in from the dialog itself or from outside', () => {
    expect(trapTarget(3, -1, false)).toBe(0)
    expect(trapTarget(3, -1, true)).toBe(2)
  })
  it('does nothing without focusable elements', () => {
    expect(trapTarget(0, -1, false)).toBeNull()
  })
})
