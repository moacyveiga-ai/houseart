import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { isPrivateFileKind } from '@/lib/private-files/core'
import { openPrivateFile } from '@/lib/private-files/server'
import { privateFileResponse } from '@/lib/private-files/response'
import { errorResponse } from '@/lib/auth/route'
import { PrivateVaultUnavailableError } from '@/lib/storage/private-vault'

export async function GET(req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const p = await ctx.params
    const id = Number(p.id)
    if (!isPrivateFileKind(p.kind) || !Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
    const file = await openPrivateFile(p.kind, id, scope)
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
    return privateFileResponse(file, new URL(req.url).searchParams.get('download') === '1')
  } catch (e) {
    if (e instanceof PrivateVaultUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 })
    return errorResponse(e)
  }
}
