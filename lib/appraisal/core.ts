// Appraisal content and its hash (the thing the appraiser signs).
import { canonical, sha256Hex } from '@/lib/certificate-events/core'

export interface AppraisalContent {
  code: string
  artwork: { publicId: string | null; title: string; year: number | null; artist: string; technique: string | null; dimensions: string }
  purpose: string
  range: { minCents: string; suggestedCents: string; maxCents: string }
  comparables: { label: string; dimensions: string | null; priceCents: string; soldOn: string; source: string }[]
  methodology: string
  appraiser: { userId: number; name: string }
  issuedAt: string
}

export function appraisalHash(content: AppraisalContent): string {
  return sha256Hex(canonical(content as unknown as Record<string, unknown>))
}
