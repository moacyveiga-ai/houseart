// A packaging photo, streamed from the private vault to either side of the deal; the seller removes one.
import { NextResponse } from 'next/server'
import { packagingPhotoRef, removePackagingPhoto } from '@/lib/deals/packaging-server'
import { openVaultFileStream, PrivateVaultUnavailableError } from '@/lib/storage/private-vault'
import { artworkErrorResponse, dealContext, idParam } from '../../../../_http'

type Ctx = { params: Promise<{ id: string; photoId: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    const photoId = idParam((await ctx.params).photoId)
    const ref = photoId ? await packagingPhotoRef(c.id, photoId) : null
    if (!ref) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    // a ref whose file left the vault is a missing photo, not a server error
    const file = await openVaultFileStream(ref).catch((e: unknown) => { if (e instanceof PrivateVaultUnavailableError) throw e; return null })
    if (!file) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    return new NextResponse(file.stream, { status: 200, headers: {
      'content-type': 'image/jpeg', ...(file.size !== null ? { 'content-length': String(file.size) } : {}),
      'content-disposition': 'inline; filename="embalagem.jpg"', 'x-content-type-options': 'nosniff', 'content-security-policy': 'sandbox', 'cache-control': 'private, no-cache',
    } })
  } catch (e) {
    if (e instanceof PrivateVaultUnavailableError) return NextResponse.json({ error: 'Foto indisponível agora.' }, { status: 503 })
    return artworkErrorResponse(e)
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.side !== 'SELLER' || !c.scope) return NextResponse.json({ error: 'Só o vendedor registra a embalagem.' }, { status: 403 })
    const photoId = idParam((await ctx.params).photoId)
    if (!photoId) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    await removePackagingPhoto(c.scope, c.id, photoId, c.user.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
