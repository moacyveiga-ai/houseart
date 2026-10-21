import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { issueCertificate } from '@/lib/certificates/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { flagGate } from '@/app/api/_flags'

export const maxDuration = 60

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = flagGate('FLAG_CERTIFICATES'); if (gate) return gate
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Certificado não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true, ...(await issueCertificate(scope, id, { userId: user.id, name: user.name })) })
  } catch (e) { return artworkErrorResponse(e) }
}
