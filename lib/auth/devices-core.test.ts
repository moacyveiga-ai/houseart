import { describe, expect, it } from 'vitest'
import { deviceLabel, deviceViews, lastUsedLabel, partialIp } from './devices-core'

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

describe('aparelhos conectados', () => {
  it('nomeia navegador e sistema', () => {
    expect(deviceLabel(CHROME_WIN)).toEqual({ label: 'Chrome no Windows', icon: 'computer' })
    expect(deviceLabel(SAFARI_IPHONE)).toEqual({ label: 'Safari no iPhone', icon: 'smartphone' })
    expect(deviceLabel(SAFARI_MAC)).toEqual({ label: 'Safari no Mac', icon: 'computer' })
    expect(deviceLabel('okhttp/4.12.0')).toEqual({ label: 'App HouseArt no Android', icon: 'smartphone' })
    expect(deviceLabel(null)).toEqual({ label: 'Aparelho desconhecido', icon: 'computer' })
  })
  it('mostra só metade do IP', () => {
    expect(partialIp('189.12.33.4')).toBe('189.12.x.x')
    expect(partialIp('2804:14c:1a2b::1')).toBe('2804:14c:…')
    expect(partialIp(null)).toBeNull()
  })
  it('último uso relativo', () => {
    const now = new Date('2026-10-27T15:00:00Z')
    expect(lastUsedLabel(new Date('2026-10-27T14:59:30Z'), now)).toBe('agora')
    expect(lastUsedLabel(new Date('2026-10-27T14:40:00Z'), now)).toBe('há 20 min')
    expect(lastUsedLabel(new Date('2026-10-27T12:00:00Z'), now)).toBe('há 3 h')
    expect(lastUsedLabel(new Date('2026-10-25T15:00:00Z'), now)).toBe('há 2 dias')
  })
  it('este aparelho primeiro, depois pelo último uso', () => {
    const now = new Date('2026-10-27T15:00:00Z')
    const v = deviceViews([
      { id: 1, userAgent: CHROME_WIN, ip: null, lastUsedAt: new Date('2026-10-20T10:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z') },
      { id: 2, userAgent: SAFARI_IPHONE, ip: null, lastUsedAt: new Date('2026-10-27T14:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z') },
      { id: 3, userAgent: SAFARI_MAC, ip: '10.0.0.1', lastUsedAt: null, createdAt: new Date('2026-10-26T15:00:00Z') },
    ], 1, now)
    expect(v.map((d) => d.id)).toEqual([1, 2, 3])
    expect(v[0]).toMatchObject({ current: true, when: 'Este aparelho' })
    expect(v[2]).toMatchObject({ when: 'há 1 dia', where: '10.0.x.x' })
  })
})
