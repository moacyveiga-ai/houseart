import { NextResponse } from 'next/server'
import { consumeOrAllow } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { recordView } from '@/lib/gallery/listing-server'
import { diaNoFuso } from '@/lib/timezone'

/** The public artwork page's beacon: one view per IP per artwork per day (bots do not run JS). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { publicId?: string }
  const publicId = String(body.publicId ?? '').toUpperCase()
  if (!/^HA-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(publicId)) return NextResponse.json({ ok: false }, { status: 404 })
  const ip = rawIpFromHeaders(req.headers)
  const day = diaNoFuso(new Date()) ?? new Date().toISOString().slice(0, 10)
  const once = await consumeOrAllow({ key: `view:${publicId}:${ip}:${day}`, limit: 1, windowMs: 24 * 3_600_000 })
  const ok = once.allowed ? await recordView(publicId) : true
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
