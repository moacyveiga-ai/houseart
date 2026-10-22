import { describe, expect, it } from 'vitest'
import { toArtworkDto } from './dto-core'

describe('toArtworkDto', () => {
  it('drops the vault key, the hashes and the look-alike owner', () => {
    const out = toArtworkDto({ id: 1, media: [{ id: 2, kind: 'BACK', publicUrl: '/x.jpg', masterRef: 'vault/a', sha256: 'h', pHash: 'p' }], duplicateChecks: [{ id: 3, candidate: { id: 4, title: 'T', memberId: 99 } }] })
    expect(JSON.stringify(out)).not.toMatch(/masterRef|sha256|pHash|memberId/)
    expect(out.media?.[0]).toMatchObject({ id: 2, kind: 'BACK', publicUrl: '/x.jpg' })
    expect(out.duplicateChecks?.[0]?.candidate).toMatchObject({ id: 4, title: 'T' })
  })
})
