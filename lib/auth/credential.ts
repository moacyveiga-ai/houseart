// The login credential: e-mail (lowercased) or CPF (digits). Pure.
import { digitsOnly, isCpf } from '@/lib/crypto/document'

export type Credential = { kind: 'empty' } | { kind: 'email'; email: string } | { kind: 'cpf'; cpf: string }

export function classifyCredential(raw: string): Credential {
  const v = (raw ?? '').trim()
  if (!v) return { kind: 'empty' }
  const digits = digitsOnly(v)
  if (!v.includes('@') && digits.length === 11 && isCpf(digits)) return { kind: 'cpf', cpf: digits }
  return { kind: 'email', email: v.toLowerCase() }
}

export function normalizeEmail(raw: string): string | null {
  const e = (raw ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null
}
