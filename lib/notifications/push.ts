// Web push (VAPID). Off without the three envs — notify() keeps working by
// bell and e-mail. Subscriptions are per browser; a 404/410 from the push
// service deletes the row.
import 'server-only'
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

export interface PushConfig { publicKey: string; privateKey: string; subject: string }

export function pushConfig(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim(), privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(), subject = env.WEB_PUSH_SUBJECT?.trim()
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

export async function savePushSubscription(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null): Promise<void> {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('BAD_SUBSCRIPTION')
  await prisma.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent }, update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent } })
}

export async function removePushSubscription(userId: number, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

/** Sends to every browser of the user; best-effort, never throws. */
export async function pushToUser(userId: number, payload: { title: string; body?: string; href?: string | null }): Promise<number> {
  const cfg = pushConfig()
  if (!cfg) return 0
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return 0
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  let sent = 0
  for (const s of subs) {
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
