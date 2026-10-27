// "Aparelhos conectados" — I/O. Only the person's own live sessions; signing out
// another device deletes its row (the cookie there stops working on the next
// request). The current session is closed by "Sair", never from this list.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { deviceViews, type DeviceView } from './devices-core'

export async function devicesOf(userId: number, currentSessionId: number | null, now = new Date()): Promise<DeviceView[]> {
  // the current session always comes back, even past the first 50 (an old one with many app logins after it)
  const rows = await prisma.session.findMany({ where: { userId, OR: [{ expiresAt: { gt: now } }, ...(currentSessionId ? [{ id: currentSessionId }] : [])] }, select: { id: true, userAgent: true, ip: true, lastUsedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  return deviceViews(rows, currentSessionId, now)
}

/** Ends one other session of the person (404 for someone else's or the current one). */
export async function signOutDevice(userId: number, currentSessionId: number | null, sessionId: number): Promise<void> {
  if (sessionId === currentSessionId) throw new ArtworkError('CURRENT_SESSION', 'Para sair deste aparelho, use "Sair da conta".', 409)
  const r = await prisma.session.deleteMany({ where: { id: sessionId, userId } })
  if (!r.count) throw new ArtworkError('NOT_FOUND', 'Aparelho não encontrado.', 404)
  void audit.event({ entity: 'user', entityId: userId, action: 'session_revoked', userId, after: { sessionId } })
}

/** Ends every session of the person except this one. */
export async function signOutOtherDevices(userId: number, currentSessionId: number | null): Promise<number> {
  if (!currentSessionId) throw new ArtworkError('NO_SESSION', 'Entre de novo para continuar.', 401)
  // the count is of the LIVE ones (what the list showed); the expired go too, quietly
  const live = await prisma.session.count({ where: { userId, id: { not: currentSessionId }, expiresAt: { gt: new Date() } } })
  const r = await prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } })
  if (r.count) void audit.event({ entity: 'user', entityId: userId, action: 'sessions_revoked', userId, after: { count: r.count } })
  return Math.min(live, r.count)
}
