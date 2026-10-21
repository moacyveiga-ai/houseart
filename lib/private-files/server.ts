// `openPrivateFile` is the ONLY read door of `GET /api/files/[kind]/[id]`:
// each family finds the stored reference and checks the session's reach with
// the SAME rule its screen uses. Out of scope or missing: null (same 404).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { canView, type Scope } from '@/lib/scope/core'
import { contentTypeOf } from '@/lib/storage/content-type'
import { openVaultFileStream, readVaultFile, type StoredFileStream } from '@/lib/storage/private-vault'
import type { PrivateFileKind } from './core'

export interface OpenedPrivateFile { body: ReadableStream<Uint8Array>; contentType: string; size: number | null; name: string }

type Loader = (id: number, scope: Scope) => Promise<string | null>

const LOADERS: Partial<Record<PrivateFileKind, Loader>> = {
  'artwork-master': async (id, scope) => {
    const m = await prisma.artworkMedia.findUnique({ where: { id }, select: { masterRef: true, artwork: { select: { memberId: true, tenantId: true } } } })
    if (!m) return null
    return canView(scope, m.artwork) ? m.masterRef : null
  },
}

export async function openPrivateFile(kind: PrivateFileKind, id: number, scope: Scope): Promise<OpenedPrivateFile | null> {
  const loader = LOADERS[kind]
  if (!loader) return null
  const ref = await loader(id, scope)
  if (!ref) return null
  // The type comes from the BYTES (head of the file), never from the storage.
  const head = (await readVaultFile(ref)).subarray(0, 1024)
  const contentType = contentTypeOf(head)
  const s: StoredFileStream = await openVaultFileStream(ref)
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  return { body: s.stream, contentType, size: s.size, name: `${kind}-${id}.${ext}` }
}
