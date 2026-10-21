// PRIVATE vault of personal documents and artwork masters (ported). The
// reference stored in the database is `vault:<pathname>` — never a URL — and
// the read goes through the scoped route (`GET /api/files/[kind]/[id]`).
//  · with BLOB_PRIVATE_READ_WRITE_TOKEN: the private Blob store (production);
//  · outside Vercel without the token: `<cwd>/.vault/` (dev/test);
//  · on Vercel without the token: PrivateVaultUnavailableError (503) — a
//    private file NEVER falls into the public store silently.
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

export const VAULT_PREFIX = 'vault:'
const EXT_OF_MIME: Record<string, string> = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif',
}

export class PrivateVaultUnavailableError extends Error {
  constructor() { super('Cofre de arquivos indisponível: configure BLOB_PRIVATE_READ_WRITE_TOKEN.'); this.name = 'PrivateVaultUnavailableError' }
}

export function isVaultRef(ref: string | null | undefined): ref is `vault:${string}` {
  return typeof ref === 'string' && ref.startsWith(VAULT_PREFIX)
}

const privateToken = (): string | undefined => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN || undefined
const onVercel = (): boolean => !!process.env.VERCEL
const vaultDir = (): string => path.join(process.cwd(), '.vault')

function pathnameOf(ref: string): string {
  const pathname = ref.slice(VAULT_PREFIX.length)
  const ok = pathname.startsWith('private/') && !pathname.includes('\0') && pathname.split('/').every((p) => p !== '' && p !== '.' && p !== '..')
  if (!ok) throw new Error('Referência do cofre inválida')
  return pathname
}

function cleanPrefix(prefix: string): string {
  return prefix.split('/').map((s) => s.replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean).join('/')
}

export async function savePrivateFile(opt: { buffer: Buffer; contentType: string; prefix: string }): Promise<string> {
  const token = privateToken()
  if (!token && onVercel()) throw new PrivateVaultUnavailableError()
  const ext = EXT_OF_MIME[opt.contentType.split(';')[0].trim()] || '.bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const prefix = cleanPrefix(opt.prefix)
  const pathname = `private/${prefix ? `${prefix}/` : ''}${filename}`
  if (token) {
    const { put } = await import('@vercel/blob')
    await put(pathname, opt.buffer, { access: 'private', contentType: opt.contentType, addRandomSuffix: false, token })
  } else {
    const dest = path.join(vaultDir(), pathname)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, opt.buffer)
  }
  return `${VAULT_PREFIX}${pathname}`
}

export async function readVaultFile(ref: string): Promise<Buffer> {
  const pathname = pathnameOf(ref)
  const token = privateToken()
  if (token) {
    const { get } = await import('@vercel/blob')
    const r = await get(pathname, { access: 'private', token })
    if (!r || r.statusCode !== 200 || !r.stream) throw new Error('Arquivo do cofre não encontrado')
    return Buffer.from(await new Response(r.stream).arrayBuffer())
  }
  if (onVercel()) throw new PrivateVaultUnavailableError()
  return readFile(path.join(vaultDir(), pathname))
}

export interface StoredFileStream { stream: ReadableStream<Uint8Array>; size: number | null }

export async function openVaultFileStream(ref: string): Promise<StoredFileStream> {
  const pathname = pathnameOf(ref)
  const token = privateToken()
  if (token) {
    const { get } = await import('@vercel/blob')
    const r = await get(pathname, { access: 'private', token })
    if (!r || r.statusCode !== 200 || !r.stream) throw new Error('Arquivo do cofre não encontrado')
    const size = r.blob?.size
    const sized = typeof size === 'number' && Number.isFinite(size) && size > 0 && !r.headers?.get('content-encoding')
    return { stream: r.stream, size: sized ? size : null }
  }
  if (onVercel()) throw new PrivateVaultUnavailableError()
  const file = path.join(vaultDir(), pathname)
  const { size } = await stat(file)
  return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, size }
}

export async function deleteVaultFile(ref: string): Promise<void> {
  if (!isVaultRef(ref)) return
  const pathname = pathnameOf(ref)
  const token = privateToken()
  if (token) {
    const { del } = await import('@vercel/blob')
    await del(pathname, { token })
    return
  }
  if (onVercel()) throw new PrivateVaultUnavailableError()
  await rm(path.join(vaultDir(), pathname), { force: true })
}
