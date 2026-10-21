import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { signCertificate } from '@/lib/certificates/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'
import { rawIpFromHeaders } from '@/lib/http/ip'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_CERTIFICATES'); if (gate) return gate
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Certificado não encontrado.' }, { status: 404 })
    const ip = rawIpFromHeaders(req.headers)
    const r = await signCertificate(scope, id, { userId: user.id, name: user.name, ip: ip === 'no-ip' ? undefined : ip, userAgent: req.headers.get('user-agent') ?? undefined })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) { return artworkErrorResponse(e) }
}
