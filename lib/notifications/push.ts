// Push: web (VAPID) for browsers and Expo Push for the mobile apps. Both
// rows live in PushSubscription; the endpoint tells them apart (`https://…`
// is a browser, `expo:ExponentPushToken[…]` is a device). Web push is off
// without the three envs — notify() keeps working by bell and e-mail; the
// Expo door needs no key (optional EXPO_ACCESS_TOKEN). A dead subscription
// (gone, rejected, device not registered) deletes its row.
import 'server-only'
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

export interface PushConfig { publicKey: string; privateKey: string; subject: string }

export function pushConfig(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim(), privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(), subject = env.WEB_PUSH_SUBJECT?.trim()
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

const EXPO_TOKEN = /^expo:(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,}\]$/
export const isExpoEndpoint = (endpoint: string): boolean => EXPO_TOKEN.test(endpoint)
export const isWebEndpoint = (endpoint: string): boolean => /^https:\/\//.test(endpoint)

export async function savePushSubscription(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null): Promise<void> {
  if (!(isWebEndpoint(sub.endpoint) || isExpoEndpoint(sub.endpoint)) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('BAD_SUBSCRIPTION')
  await prisma.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent }, update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent } })
}

export async function removePushSubscription(userId: number, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send'
const DEAD_EXPO = new Set(['DeviceNotRegistered', 'InvalidCredentials'])

/** One Expo message per device; `data.href` is what the app opens. Returns the ids of rows to delete. */
async function sendExpo(rows: { id: number; endpoint: string }[], payload: { title: string; body?: string; href?: string | null }, env: Record<string, string | undefined> = process.env): Promise<{ sent: number; dead: number[] }> {
  const dead: number[] = []
  let sent = 0
  const messages = rows.map((r) => ({ to: r.endpoint.slice('expo:'.length), title: payload.title, body: payload.body ?? undefined, data: { href: payload.href ?? null }, sound: 'default' as const, channelId: 'default' }))
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100), batchRows = rows.slice(i, i + 100)
    try {
      const res = await fetch(EXPO_SEND, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(batch), signal: AbortSignal.timeout(8000) })
      const j = (await res.json().catch(() => ({}))) as { data?: { status: 'ok' | 'error'; details?: { error?: string } }[] }
      ;(j.data ?? []).forEach((t, k) => {
        if (t.status === 'ok') sent++
        else if (t.details?.error && DEAD_EXPO.has(t.details.error)) dead.push(batchRows[k]!.id)
        else console.warn('[push] expo rejected', t.details?.error ?? 'unknown')
      })
    } catch (e) { console.warn('[push] expo failed', (e as Error).name) }
  }
  return { sent, dead }
}

/** Sends to every browser and device of the user; best-effort, never throws. */
export async function pushToUser(userId: number, payload: { title: string; body?: string; href?: string | null }): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return 0
  let sent = 0
  const expo = subs.filter((s) => isExpoEndpoint(s.endpoint))
  if (expo.length) {
    const r = await sendExpo(expo, payload)
    sent += r.sent
    if (r.dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: r.dead } } }).catch(() => undefined)
    if (r.sent) await prisma.pushSubscription.updateMany({ where: { id: { in: expo.map((s) => s.id) }, NOT: { id: { in: r.dead } } }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
  }
  const cfg = pushConfig()
  const web = subs.filter((s) => isWebEndpoint(s.endpoint))
  if (!cfg || !web.length) return sent
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  for (const s of web) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 })
      sent++
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // gone (404/410) or rejected for this VAPID key (400/401/403): the row never works again
      if (status === 400 || status === 401 || status === 403 || status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined)
      else console.warn('[push] failed', status ?? (e as Error).name)
    }
  }
  return sent
}
