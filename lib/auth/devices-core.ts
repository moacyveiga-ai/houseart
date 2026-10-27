// "Aparelhos conectados" (Perfil › Segurança e privacidade) — PURE. A session row
// becomes a line the person recognises: browser and system from the user agent,
// a partial IP, when it was last used. Nothing here is a secret: the token never
// leaves the database (only its hash is stored) and the row id is the handle.

export type DeviceIcon = 'smartphone' | 'tablet' | 'computer'

export interface DeviceRow { id: number; userAgent: string | null; ip: string | null; lastUsedAt: Date | null; createdAt: Date }
export interface DeviceView { id: number; label: string; icon: DeviceIcon; where: string | null; when: string; current: boolean }

function browserOf(ua: string): string | null {
  if (/HouseArt|Expo|okhttp|CFNetwork|Dalvik/i.test(ua)) return 'App HouseArt'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox'
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return null
}

function systemOf(ua: string): { name: string; icon: DeviceIcon } | null {
  if (/iPad/.test(ua)) return { name: 'iPad', icon: 'tablet' }
  if (/iPhone|iOS|CFNetwork|Darwin/.test(ua) && !/Macintosh/.test(ua)) return { name: 'iPhone', icon: 'smartphone' }
  if (/Android/.test(ua) || /okhttp|Dalvik/.test(ua)) return { name: 'Android', icon: /Mobile|okhttp|Dalvik/.test(ua) ? 'smartphone' : 'tablet' }
  if (/Windows/.test(ua)) return { name: 'Windows', icon: 'computer' }
  if (/Macintosh|Mac OS X/.test(ua)) return { name: 'Mac', icon: 'computer' }
  if (/CrOS/.test(ua)) return { name: 'Chromebook', icon: 'computer' }
  if (/Linux/.test(ua)) return { name: 'Linux', icon: 'computer' }
  return null
}

/** "Chrome no Windows", "App HouseArt no iPhone", "Aparelho desconhecido". */
export function deviceLabel(userAgent: string | null): { label: string; icon: DeviceIcon } {
  const ua = userAgent ?? ''
  const b = browserOf(ua)
  const s = systemOf(ua)
  if (b && s) return { label: `${b} no ${s.name}`, icon: s.icon }
  if (b) return { label: b, icon: b === 'App HouseArt' ? 'smartphone' : 'computer' }
  if (s) return { label: s.name, icon: s.icon }
  return { label: 'Aparelho desconhecido', icon: 'computer' }
}

/** Only the first half of the address: enough to recognise a network, never the full IP on screen. */
export function partialIp(ip: string | null): string | null {
  if (!ip) return null
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (v4) return `${v4[1]}.${v4[2]}.x.x`
  const v6 = ip.split(':').filter(Boolean)
  return v6.length >= 2 ? `${v6[0]}:${v6[1]}:…` : null
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias", then the date. */
export function lastUsedLabel(at: Date, now: Date): string {
  const min = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (min < 2) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
  return at.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bahia' })
}

/** The list, this device first, then by last use. */
export function deviceViews(rows: readonly DeviceRow[], currentId: number | null, now: Date): DeviceView[] {
  return [...rows]
    .sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : (b.lastUsedAt ?? b.createdAt).getTime() - (a.lastUsedAt ?? a.createdAt).getTime()))
    .map((r) => {
      const d = deviceLabel(r.userAgent)
      return { id: r.id, label: d.label, icon: d.icon, where: partialIp(r.ip), when: r.id === currentId ? 'Este aparelho' : lastUsedLabel(r.lastUsedAt ?? r.createdAt, now), current: r.id === currentId }
    })
}
