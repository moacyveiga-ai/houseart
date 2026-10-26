// The search box of the light public header ("Obra, artista ou ID", audit público §31). Pure.
// A certificate or appraisal id goes straight to its verification page; anything that starts
// with "HA-" but is not a full id searches the verification; the rest searches the marketplace.
import { isPublicId } from '@/lib/physical-markers/domain'

export function headerSearchTarget(raw: string): string | null {
  const v = raw.trim().slice(0, 120)
  if (!v) return null
  const up = v.toUpperCase()
  if (isPublicId(up) || /^HA-L-[0-9A-Z-]+$/.test(up)) return `/verify/${encodeURIComponent(up)}`
  if (up.startsWith('HA-')) return `/verify?id=${encodeURIComponent(up)}`
  return `/e/marketplace?q=${encodeURIComponent(v)}`
}
