import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { errorResponse } from '@/lib/auth/route'
import { pushConfig, removePushSubscription, savePushSubscription } from '@/lib/notifications/push'

/** The VAPID public key (null = push off). */
export async function GET() {
  try { await requireAuth(); return NextResponse.json({ publicKey: pushConfig()?.publicKey ?? null }) } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    if (!pushConfig()) return NextResponse.json({ error: 'Push desligado.' }, { status: 503 })
    const sub = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 })
    await savePushSubscription(u.id, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, req.headers.get('user-agent')?.slice(0, 200) ?? null)
    return NextResponse.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(req: Request) {
  try {
    const u = await requireAuth()
    const b = (await req.json().catch(() => ({}))) as { endpoint?: unknown }
    if (typeof b.endpoint !== 'string') return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 })
    await removePushSubscription(u.id, b.endpoint)
    return NextResponse.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
