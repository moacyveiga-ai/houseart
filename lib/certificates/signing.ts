// Issuer signature (JWS EdDSA with the platform key) and the timestamp
// token. Env `CERTIFICATE_SIGNING_SEED` (32 bytes base64) is the Ed25519 seed;
// without it, a DEV seed is derived (never in production). The timestamp
// authority is `mock` in the MVP (TIMESTAMP_AUTHORITY_URL unset): the token
// is sha256(hash + time) signed by the same key — enough to prove ordering,
// NOT an ICP-Brasil stamp (HOUSEART_BUILD.md §J).
import { createHash, createPrivateKey, createPublicKey, scryptSync, sign, verify, type KeyObject } from 'node:crypto'

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

function seed(): Buffer {
  const raw = process.env.CERTIFICATE_SIGNING_SEED?.trim()
  if (raw) {
    const b = Buffer.from(raw, 'base64')
    if (b.length !== 32) throw new Error('CERTIFICATE_SIGNING_SEED must decode to 32 bytes')
    return b
  }
  if (process.env.NODE_ENV === 'production') throw new Error('CERTIFICATE_SIGNING_SEED ausente em produção')
  return scryptSync('houseart-certificate-signing-dev', 'houseart-signing-salt', 32)
}

export function signingKey(): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed()]), format: 'der', type: 'pkcs8' })
}

export function publicKeyJwk(): Record<string, unknown> {
  return createPublicKey(signingKey()).export({ format: 'jwk' }) as Record<string, unknown>
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Compact JWS (EdDSA) over a JSON payload. */
export function signJws(payload: Record<string, unknown>): string {
  const header = b64u(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: 'houseart-issuer-1' }))
  const body = b64u(JSON.stringify(payload))
  const sig = sign(null, Buffer.from(`${header}.${body}`), signingKey())
  return `${header}.${body}.${b64u(sig)}`
}

export function verifyJws(jws: string): Record<string, unknown> | null {
  const [h, b, s] = jws.split('.')
  if (!h || !b || !s) return null
  const ok = verify(null, Buffer.from(`${h}.${b}`), createPublicKey(signingKey()), Buffer.from(s, 'base64url'))
  if (!ok) return null
  return JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) as Record<string, unknown>
}

export interface TimestampToken { provider: 'mock' | 'icp-brasil'; hash: string; time: string; token: string }

export function timestamp(hash: string, now = new Date()): TimestampToken {
  const time = now.toISOString()
  const token = signJws({ typ: 'tst', hash, time, provider: 'mock' })
  return { provider: 'mock', hash, time, token }
}

export function sha256OfBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
