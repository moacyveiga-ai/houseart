import { describe, expect, it } from 'vitest'
import { sanitizePreferences } from './preferences-core'

describe('preferences', () => {
  it('keeps only allowlisted values, deduplicated, and trims the city', () => {
    expect(sanitizePreferences({ uses: ['SELL', 'SELL', 'HACK'], interests: ['PAINTING', 3], city: '  Salvador  ' })).toEqual({ uses: ['SELL'], interests: ['PAINTING'], city: 'Salvador' })
    expect(sanitizePreferences(null)).toEqual({ uses: [], interests: [], city: '' })
  })
})
