import { describe, expect, it } from 'vitest'
import { bubbleTime, conversationIdOfPath, mergeMessages, roleOfProfile, touchRow, type ConversationView, type MessageView } from './messages-core'

const m = (id: number): MessageView => ({ id, mine: false, kind: 'TEXT', body: `m${id}`, at: '2026-10-22T13:00:00.000Z', offerId: null })
const row = (id: number, unread = 0): ConversationView => ({ id, artworkId: null, artworkTitle: null, artworkPublicId: null, artworkCoverUrl: null, other: { id: 9, name: 'Ana', initials: 'A', sub: 'Galeria' }, preview: 'p', when: 'agora', unread })

describe('messages-core', () => {
  it('bubbleTime: today = hh:mm, yesterday prefixed, older with the date (America/Bahia)', () => {
    const now = new Date('2026-10-22T18:00:00.000Z')
    expect(bubbleTime('2026-10-22T13:12:00.000Z', now)).toBe('10:12')
    expect(bubbleTime('2026-10-21T13:12:00.000Z', now)).toBe('ontem 10:12')
    expect(bubbleTime('2026-10-03T13:12:00.000Z', now)).toBe('03/10 10:12')
    expect(bubbleTime('nope', now)).toBe('')
  })
  it('mergeMessages keeps order and drops duplicates', () => {
    expect(mergeMessages([m(1), m(2)], [m(2), m(3)]).map((x) => x.id)).toEqual([1, 2, 3])
    const same = [m(1)]
    expect(mergeMessages(same, [])).toBe(same)
  })
  it('conversationIdOfPath reads /messages/<id> only', () => {
    expect(conversationIdOfPath('/messages/12')).toBe(12)
    expect(conversationIdOfPath('/messages')).toBeNull()
    expect(conversationIdOfPath('/messages/abc')).toBeNull()
  })
  it('roleOfProfile: collector buys, everyone else sells', () => {
    expect(roleOfProfile('collector')).toBe('buyer')
    expect(roleOfProfile('gallery')).toBe('seller')
  })
  it('touchRow moves the conversation to the top, read, with the new preview', () => {
    const out = touchRow([row(1), row(2, 3)], row(2, 3), { preview: 'Você: oi' })
    expect(out.map((r) => r.id)).toEqual([2, 1])
    expect(out[0]).toMatchObject({ unread: 0, preview: 'Você: oi' })
    expect(touchRow([row(1)], row(5), {}).map((r) => r.id)).toEqual([5, 1])
  })
})
