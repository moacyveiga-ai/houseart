import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth'
import { identityOf, setIdentity } from '@/lib/accounts/identity-server'
import { setAbout } from '@/lib/profile/server'

const schema = z.object({ cpf: z.string().max(20).optional(), city: z.string().max(80).optional(), name: z.string().max(120).optional(), about: z.string().max(2000).optional() })

/** The identity checks of the offer flow: CPF (mask), phone and e-mail verified, city. */
export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, identity: await identityOf(u.id) }, { headers: { 'cache-control': 'no-store' } }) }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 }); throw e }
}

export async function PATCH(req: Request) {
  let u
  try { u = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  const { about, ...rest } = parsed.data
  if (typeof about === 'string') {
    const a = await setAbout(u.id, about)
    if (!a.ok) return NextResponse.json(a, { status: 400 })
  }
  const r = await setIdentity(u.id, rest)
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json(r)
}
