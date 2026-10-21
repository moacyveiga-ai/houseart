import { NextResponse } from 'next/server'
import { dispositionFor } from '@/lib/storage/content-type'
import type { OpenedPrivateFile } from './server'

export function privateFileResponse(file: OpenedPrivateFile, download: boolean): NextResponse {
  return new NextResponse(file.body, {
    status: 200,
    headers: {
      'content-type': file.contentType,
      ...(file.size !== null ? { 'content-length': String(file.size) } : {}),
      'content-disposition': `${dispositionFor(file.contentType, download)}; filename="${file.name}"`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': 'sandbox',
      'cache-control': 'private, no-store',
    },
  })
}
