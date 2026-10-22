// Avisos — pure helpers (handoff "HouseArt App Artista" › Avisos: round icon
// per kind, title, sub and "quando"). The icon follows the kind prefix of
// `notify()`; a certificate/deed aviso is the verified green of the prototype.

export interface NotificationRow { id: number; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string }

export type NotificationTone = 'unread' | 'read' | 'verified'

export function iconOf(kind: string): string {
  const head = kind.split('.')[0]
  switch (head) {
    case 'offer': return 'handshake'
    case 'message': return 'chat_bubble'
    case 'community': return 'forum'
    case 'deal': return 'local_shipping'
    case 'certificate': return 'contract'
    case 'ownership': return 'swap_horiz'
    case 'royalty': return 'autorenew'
    case 'appraisal': return 'assignment'
    case 'billing': return 'receipt_long'
    default: return 'notifications'
  }
}

/** Tone of the round icon: green for what was issued/concluded, sand while unread, paper once read. */
export function toneOf(n: Pick<NotificationRow, 'kind' | 'readAt'>): NotificationTone {
  const head = n.kind.split('.')[0]
  if (head === 'certificate' || head === 'royalty' || n.kind === 'deal.completed' || n.kind === 'ownership.completed') return 'verified'
  return n.readAt ? 'read' : 'unread'
}

/** "agora", "2 h", "ontem", "02/03" — the compact stamp of the prototype's right column. */
export function whenShort(iso: string, now = new Date()): string {
  const at = new Date(iso)
  const diff = now.getTime() - at.getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000 && at.getDate() === now.getDate()) return `${Math.floor(diff / 3_600_000)} h`
  if (diff < 2 * 86_400_000) return 'ontem'
  return at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })
}

/** The VAPID key as the browser's PushManager wants it. */
export function vapidKeyBytes(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
