// In-app notifications (bell) + the e-mail door. `notify()` is the single
// producer; e-mail templates are plain text for now (D.21 layout is pending).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { afterResponseOrNow } from '@/lib/after'
import { sendEmail } from '@/lib/email/send'
import { pushToUser } from './push'

export interface NotifyInput {
  userId: number | null
  email?: string | null
  kind: string
  title: string
  body?: string
  href?: string | null
  /** e-mail subject; without it no e-mail goes out */
  emailSubject?: string
}

export async function notify(n: NotifyInput): Promise<void> {
  if (n.userId) {
    await prisma.notification.create({ data: { userId: n.userId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null } })
    const uid = n.userId
    await afterResponseOrNow(`push:${n.kind}`, () => pushToUser(uid, { title: n.title, body: n.body, href: n.href ?? null }))
  }
  if (n.email && n.emailSubject) {
    const email = n.email, subject = n.emailSubject
    await afterResponseOrNow(`notify:${n.kind}`, () => sendEmail({ to: email, subject, text: `${n.title}\n\n${n.body ?? ''}`, redactedPreview: n.kind }))
  }
}

export async function unreadCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

export async function listNotifications(userId: number, take = 50) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
}

export async function markRead(userId: number, id: number): Promise<void> {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
}

export async function markAllRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
}
