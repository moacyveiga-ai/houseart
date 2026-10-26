import { NextResponse } from 'next/server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { ipHashOf, recordPublicRead } from '@/lib/physical-markers/server'
import { consumeOrAllow, rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

/**
 * The tag reading of Verificar in the mobile app: the SUN message the tag
 * wrote (`{ uid, ctr, cmac, tt? }`, `tt` the mirrored TT status, checked inside the CMAC), recorded exactly as the visit to
 * `/verify/[publicId]?uid&ctr&cmac` records it (`recordPublicRead`). Answers
 * only `{ authenticated, tamper }` — the same two flags the page shows.
 * A malformed number is 404 and a bad body 400; a tag that is not of this
 * artwork answers `authenticated: false` (no oracle about other numbers).
 */
export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const publicId = (await ctx.params).publicId.toUpperCase()
  if (!isPublicId(publicId)) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const ip = rawIpFromHeaders(req.headers)
  const brake = await consumeOrAllow({ key: `verify-read:ip:${ip}`, limit: 60, windowMs: 3_600_000 })
  if (!brake.allowed) return rateLimitResponse(brake)
  const b = (await req.json().catch(() => ({}))) as { uid?: unknown; ctr?: unknown; cmac?: unknown; tt?: unknown }
  const uid = typeof b.uid === 'string' && /^[0-9a-fA-F]{14}$/.test(b.uid) ? b.uid : null
  const ctr = typeof b.ctr === 'number' && Number.isInteger(b.ctr) && b.ctr >= 0 && b.ctr <= 0xffffff ? b.ctr : null
  const cmac = typeof b.cmac === 'string' && /^[0-9a-fA-F]{16}$/.test(b.cmac) ? b.cmac : null
  if (!uid || ctr === null || !cmac) return NextResponse.json({ error: 'Leitura inválida.' }, { status: 400 })
  // a legacy boolean `tt: true` is still a tamper claim: recorded, but it can never authenticate
  const tt = typeof b.tt === 'string' ? b.tt.slice(0, 8) : b.tt === true ? '1' : undefined
  const read = await recordPublicRead(publicId, { uid, ctr, cmac, tt }, ipHashOf(ip))
  return NextResponse.json({ ok: true, read: { authenticated: read.authenticated, tamper: read.tamper } }, { headers: { 'cache-control': 'no-store' } })
}
