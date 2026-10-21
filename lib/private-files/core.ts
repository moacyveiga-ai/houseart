// Private files read through the scoped route. Pure: kinds and hrefs.
export const PRIVATE_FILE_KINDS = ['artwork-master', 'artwork-doc', 'certificate-pdf', 'appraisal-pdf', 'contract', 'signed-contract', 'kyc-doc'] as const
export type PrivateFileKind = (typeof PRIVATE_FILE_KINDS)[number]

export function isPrivateFileKind(k: string): k is PrivateFileKind {
  return (PRIVATE_FILE_KINDS as readonly string[]).includes(k)
}

/** The href the DTO carries instead of the stored reference. */
export function fileHref(kind: PrivateFileKind, id: number, download = false): string {
  return `/api/files/${kind}/${id}${download ? '?download=1' : ''}`
}

export { contentTypeOf, dispositionFor, fileKindOfContentType, fileKindOfRef, type FileKind } from '@/lib/storage/content-type'
