import { NextResponse } from 'next/server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { contestCertificate } from '@/lib/certificates/server'
import { consumeOrAllow, rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'

export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const publicId = (await ctx.params).publicId.toUpperCase()
  if (!isPublicId(publicId)) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const ip = rawIpFromHeaders(req.headers)
  const brake = await consumeOrAllow({ key: `contest:ip:${ip}`, limit: 5, windowMs: 3_600_000 })
  if (!brake.allowed) return rateLimitResponse(brake)
  const body = await req.json().catch(() => ({})) as { reason?: string }
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 10) return NextResponse.json({ error: 'Descreva o motivo (mínimo 10 caracteres).' }, { status: 400 })
  const ok = await contestCertificate(publicId, reason)
  // Same answer whether or not the certificate exists/accepts: no oracle.
  return NextResponse.json({ ok: true, received: ok })
}
