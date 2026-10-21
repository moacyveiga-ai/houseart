// PUBLIC file storage — Vercel Blob with BLOB_READ_WRITE_TOKEN, local
// `public/uploads` without it (dev). Only derivatives and public media go here.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EXT_OF_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf',
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
  const dir = path.join(process.cwd(), 'public', 'uploads', opt.prefix || '')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), opt.buffer)
  return `/uploads/${key}`
}

export async function readPublicFile(url: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Falha ao baixar o arquivo (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }
  return readFile(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
}
