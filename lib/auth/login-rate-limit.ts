// Persistent brake of login and codes (ported). Two buckets on login, checked
// BEFORE touching the password: by IP (60/10 min) and by account (8/15 min →
// 15 min block; success resets the account bucket, never the IP one).
import { consume, hashKeyPart, reset, type RateLimitDecision, type RateLimitPolicy } from '@/lib/rate-limit'
import { classifyCredential } from './credential'

const MIN = 60_000
export const LOGIN_IP_POLICY: RateLimitPolicy = { limit: 60, windowMs: 10 * MIN }
export const LOGIN_ACCOUNT_POLICY: RateLimitPolicy = { limit: 8, windowMs: 15 * MIN, blockMs: 15 * MIN }
export const CODE_IP_POLICY: RateLimitPolicy = { limit: 10, windowMs: 15 * MIN }
export const CODE_EMAIL_POLICY: RateLimitPolicy = { limit: 5, windowMs: 60 * MIN, blockMs: 30 * MIN }

export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; dimension: 'ip' | 'account'; decision: Extract<RateLimitDecision, { allowed: false }> }

export function loginAccountKey(credential: string): string | null {
  const c = classifyCredential(credential)
  if (c.kind === 'empty') return null
  return `login:account:${hashKeyPart(c.kind === 'cpf' ? `cpf:${c.cpf}` : `email:${c.email}`)}`
}

export async function checkLoginRateLimit(opt: { ip: string; credential: string }): Promise<LoginRateLimitResult> {
  if (opt.ip !== 'no-ip') {
    const byIp = await consume({ key: `login:ip:${opt.ip}`, ...LOGIN_IP_POLICY })
    if (!byIp.allowed) return { allowed: false, dimension: 'ip', decision: byIp }
  }
  const key = loginAccountKey(opt.credential)
  if (!key) return { allowed: true }
  const byAccount = await consume({ key, ...LOGIN_ACCOUNT_POLICY })
  if (!byAccount.allowed) return { allowed: false, dimension: 'account', decision: byAccount }
  return { allowed: true }
}

export async function clearLoginRateLimit(credential: string): Promise<void> {
  const key = loginAccountKey(credential)
  if (key) await reset(key)
}

export async function checkCodeRateLimit(opt: { ip: string; email: string }): Promise<LoginRateLimitResult> {
  if (opt.ip !== 'no-ip') {
    const byIp = await consume({ key: `code:ip:${opt.ip}`, ...CODE_IP_POLICY })
    if (!byIp.allowed) return { allowed: false, dimension: 'ip', decision: byIp }
  }
  const byEmail = await consume({ key: `code:email:${hashKeyPart(opt.email)}`, ...CODE_EMAIL_POLICY })
  if (!byEmail.allowed) return { allowed: false, dimension: 'account', decision: byEmail }
  return { allowed: true }
}
