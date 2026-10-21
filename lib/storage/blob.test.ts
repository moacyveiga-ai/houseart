import { describe, expect, it } from 'vitest'
import { isPublicMediaKey, publicMediaContentType, PUBLIC_MEDIA_ROUTE } from './blob'

describe('public media keys (derivatives served by the app)', () => {
  it('accepts <prefix>/<file> with plain segments and a known extension', () => {
    expect(isPublicMediaKey('artworks/12/1700000000-abc123.jpg')).toBe(true)
    expect(publicMediaContentType('artworks/12/x.webp')).toBe('image/webp')
    expect(PUBLIC_MEDIA_ROUTE).toBe('/api/public/media/')
  })
  it('refuses traversal, empty segments, odd characters and unknown extensions', () => {
    for (const k of ['', '../x.jpg', 'a//b.jpg', 'a/./b.jpg', 'a b.jpg', 'a/b.exe', 'a/b', 'a%2f../b.jpg', 'x'.repeat(301) + '.jpg']) expect(isPublicMediaKey(k), k).toBe(false)
  })
})
