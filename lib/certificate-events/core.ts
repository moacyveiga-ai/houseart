// Hash primitives of the certificate chain — PURE, no imports from
// lib/certificates (physical-markers and certificates both depend on this).
import { createHash } from 'node:crypto'

/** Deterministic JSON: keys sorted at every depth, no undefined. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
  }
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'bigint') return v.toString()
  return v
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function chainHash(prevHash: string | null, payload: unknown): string {
  return sha256Hex(`${prevHash ?? ''}${canonical(payload)}`)
}

