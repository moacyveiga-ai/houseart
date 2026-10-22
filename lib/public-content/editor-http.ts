// HTTP edge of the content editor routes: session guards and error mapping.
// Routes stay thin — they read the body and call editor-server.
import { NextResponse } from 'next/server'
import { requirePanel, type PanelSession } from '@/lib/auth/panel'
import { authErrorResponse } from '@/lib/auth/route'
import { canEditPublicContent } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { ContentError } from './editor-core'

export function contentErrorResponse(e: unknown): NextResponse {
  const auth = authErrorResponse(e)
  if (auth) return auth
  if (e instanceof ContentError) return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status })
  console.error('[content-editor] unhandled', e instanceof Error ? e.name : e)
  return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 })
}

/** Panel session (401/403 by the guard). */
export async function contentSession(): Promise<PanelSession> {
  return requirePanel()
}

/** The house team that edits news and agenda: anyone else gets 403. */
export async function contentEditorSession(): Promise<PanelSession> {
  const s = await requirePanel()
  if (!canEditPublicContent(s.user)) throw new ContentError('FORBIDDEN', 'Acesso restrito à equipe de conteúdo.', 403)
  return s
}

export function actorOf(s: PanelSession, req: Request) {
  return { userId: s.user.id, userName: s.user.name, ...requestContext(req) }
}

export function idParam(raw: string | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null
}

/** The `file` of a multipart body, with the size checked by the header first. */
export async function fileOf(req: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > maxBytes + 512 * 1024) throw new ContentError('TOO_LARGE', 'Imagem acima de 10 MB.', 413)
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw new ContentError('NO_FILE', 'Envie o arquivo no campo `file`.', 400)
  if (file.size > maxBytes) throw new ContentError('TOO_LARGE', 'Imagem acima de 10 MB.', 413)
  return Buffer.from(await file.arrayBuffer())
}

export const bodyOf = (req: Request): Promise<unknown> => req.json().catch(() => ({}))
export const noStore = { headers: { 'cache-control': 'no-store' } }
