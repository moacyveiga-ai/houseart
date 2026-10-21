// PUBLIC file storage — derivatives and public media only (never a master, never a
// document). Three homes, in order:
//  · BLOB_READ_WRITE_TOKEN: the public Blob store, URL served by Vercel;
//  · only the private store token: the file goes to the private store under
//    `public/<key>` and is served by the app at `/api/public/media/<key>`, with an
//    immutable cache header so the CDN keeps it — one store is enough in production;
//  · neither (dev/test): `public/uploads`.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { privateStoreToken } from './private-vault'

const EXT_OF_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf',
}
const MIME_OF_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
}

/** Where the app serves a derivative kept in the private store. */
export const PUBLIC_MEDIA_ROUTE = '/api/public/media/'
/** Folder of the derivatives inside the private store (apart from `private/`, the vault). */
const DERIVATIVE_FOLDER = 'public/'

/** A derivative key is `<prefix>/<file>` with plain segments and a known extension. */
export function isPublicMediaKey(key: string): boolean {
  if (!key || key.length > 300 || key.includes('\0')) return false
  const parts = key.split('/')
  if (parts.some((p) => p === '' || p === '.' || p === '..' || !/^[a-zA-Z0-9_.-]+$/.test(p))) return false
  return path.extname(parts[parts.length - 1]) in MIME_OF_EXT
}

export function publicMediaContentType(key: string): string {
  return MIME_OF_EXT[path.extname(key)] ?? 'application/octet-stream'
}

export async function savePublicFile(opt: { buffer: Buffer; contentType: string; prefix?: string }): Promise<string> {
  const ext = EXT_OF_MIME[opt.contentType.split(';')[0].trim()] || '.bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const key = `${opt.prefix ? `${opt.prefix}/` : ''}${filename}`
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`uploads/${key}`, opt.buffer, { access: 'public', contentType: opt.contentType })
    return blob.url
  }
  const token = privateStoreToken()
  if (token) {
    const { put } = await import('@vercel/blob')
    await put(`${DERIVATIVE_FOLDER}${key}`, opt.buffer, { access: 'private', contentType: opt.contentType, addRandomSuffix: false, token })
    return `${PUBLIC_MEDIA_ROUTE}${key}`
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', opt.prefix || '')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), opt.buffer)
  return `/uploads/${key}`
}

/** The bytes of a derivative kept in the private store, or null when it is not there. */
export async function readPublicMedia(key: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!isPublicMediaKey(key)) return null
  const token = privateStoreToken()
  if (!token) return null
  const { get } = await import('@vercel/blob')
  const r = await get(`${DERIVATIVE_FOLDER}${key}`, { access: 'private', token })
  if (!r || r.statusCode !== 200 || !r.stream) return null
  return { bytes: Buffer.from(await new Response(r.stream).arrayBuffer()), contentType: publicMediaContentType(key) }
}

export async function readPublicFile(url: string): Promise<Buffer> {
  if (url.startsWith(PUBLIC_MEDIA_ROUTE)) {
    const media = await readPublicMedia(url.slice(PUBLIC_MEDIA_ROUTE.length))
    if (!media) throw new Error('Arquivo público não encontrado')
    return media.bytes
  }
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Falha ao baixar o arquivo (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }
  return readFile(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
}
