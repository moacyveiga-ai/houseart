import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { completeConnect } from '@/lib/instagram/server'
import { publicBaseUrl } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

/** Instagram (or the mock page) comes back here; the person lands on /instagram with the outcome. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const back = (q: string) => NextResponse.redirect(`${publicBaseUrl()}/instagram?ig=${q}`)
  const u = await getSession()
  // without a session the middleware already answers 401 to /api/*; same here (the route guard)
  if (!u) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
  if (sp.get('error')) return back('cancelado')
  const r = await completeConnect(u.id, sp.get('code'), sp.get('state'))
  return back(r.ok ? 'conectado' : r.error)
}
