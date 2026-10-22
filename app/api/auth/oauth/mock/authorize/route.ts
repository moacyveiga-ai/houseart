import { NextResponse } from 'next/server'
import { mockAllowed } from '@/lib/auth/oauth/core'

/**
 * The MOCK identity provider (dev/CI only, OAUTH_MOCK=1 outside production):
 * a tiny page that asks an e-mail and sends it back as the `code`. Never a
 * real login door: `resolveIdentity` refuses MOCK whenever it is not allowed.
 */
export async function GET(req: Request) {
  if (!mockAllowed(process.env)) return NextResponse.json({ ok: false }, { status: 404 })
  const sp = new URL(req.url).searchParams
  const state = sp.get('state') ?? ''
  const redirect = sp.get('redirect_uri') ?? ''
  const safe = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Provedor simulado</title>
<body style="font-family:system-ui;padding:32px;max-width:420px"><h1 style="font-size:20px">Provedor simulado (dev)</h1>
<p>Nenhuma conta externa é consultada. Informe o e-mail que o provedor "devolveria".</p>
<form method="get" action="${safe(redirect)}"><input type="hidden" name="state" value="${safe(state)}">
<label>E-mail <input name="code" type="email" required autofocus style="display:block;width:100%;padding:8px;margin:8px 0"></label>
<button type="submit" style="padding:8px 16px">Continuar</button></form></body></html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}
