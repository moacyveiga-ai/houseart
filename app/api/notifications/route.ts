import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { listNotifications, markAllRead, unreadCount } from '@/lib/notifications/server'
import { errorResponse } from '@/lib/auth/route'

export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ unread: await unreadCount(u.id), items: await listNotifications(u.id) }) } catch (e) { return errorResponse(e) }
}
export async function POST() {
  try { const u = await requireAuth(); await markAllRead(u.id); return NextResponse.json({ ok: true }) } catch (e) { return errorResponse(e) }
}
