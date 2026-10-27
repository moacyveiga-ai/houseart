// One-time codes by e-mail — PURE decisions (no I/O). Ported from the origin's
// client access codes: blind responses, hashed code, atomic attempts, blocks.
import { createHash, randomBytes, randomInt } from 'node:crypto'

export const CODE_PURPOSES = ['SIGNUP', 'LOGIN', 'SILENT', 'PHONE', 'RESET', 'EMAIL_CHANGE'] as const
export const RESET_TTL_MS = 60 * 60_000
/** Outside production, AUTH_CODE_ECHO=1 returns the code in the start response (smoke/dev). Never on Vercel production. */
export function codeEchoAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.AUTH_CODE_ECHO === '1' && env.VERCEL_ENV !== 'production'
}
export type CodePurpose = (typeof CODE_PURPOSES)[number]

export const CODE_TTL_MS = 15 * 60_000
export const CODE_MAX_ATTEMPTS = 5
export const CODE_MAX_RESENDS = 3
export const CODE_BLOCK_MS = 30 * 60_000

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function newToken(): string {
  return randomBytes(24).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export interface CodeRow {
  purpose: string
  codeHash: string
  attempts: number
  blockedUntil: Date | null
  expiresAt: Date
  consumedAt: Date | null
}

export type CodeVerdict =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'consumed' | 'blocked' | 'wrong'; attemptsLeft: number; block: boolean }

/** `attempts` is the count AFTER this attempt (the server increments atomically before deciding). */
export function verifyCode(row: CodeRow, code: string, now: Date): CodeVerdict {
  if (row.consumedAt) return { ok: false, reason: 'consumed', attemptsLeft: 0, block: false }
  if (row.blockedUntil && row.blockedUntil > now) return { ok: false, reason: 'blocked', attemptsLeft: 0, block: false }
  if (row.expiresAt <= now) return { ok: false, reason: 'expired', attemptsLeft: 0, block: false }
  // A SILENT row carries a random code nobody received: it never opens anything.
  if (row.purpose !== 'SILENT' && /^\d{6}$/.test(code) && sha256(code) === row.codeHash) return { ok: true }
  const left = Math.max(0, CODE_MAX_ATTEMPTS - row.attempts)
  return { ok: false, reason: 'wrong', attemptsLeft: left, block: left === 0 }
}

export function verdictMessage(v: Exclude<CodeVerdict, { ok: true }>): string {
  if (v.reason === 'wrong' && v.attemptsLeft > 0) return `Código inválido. Restam ${v.attemptsLeft} tentativas.`
  return 'Código inválido ou expirado. Peça um novo código.'
}
