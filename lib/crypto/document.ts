// CPF/CNPJ normalization and validation — no side effects, no I/O. Golden rule:
// the raw value NEVER appears in a log, an error message or request metadata.
export type DocumentType = 'CPF' | 'CNPJ'

/** Validation error that NEVER carries the document value. */
export class InvalidDocumentError extends Error {
  constructor() { super('CPF/CNPJ inválido'); this.name = 'InvalidDocumentError' }
}

export function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D+/g, '')
}

function dvByWeight(base: string, initialWeight: number): number {
  let sum = 0, weight = initialWeight
  for (const ch of base) { sum += Number(ch) * weight; weight -= 1 }
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

export function isCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  if (dvByWeight(digits.slice(0, 9), 10) !== Number(digits[9])) return false
  return dvByWeight(digits.slice(0, 10), 11) === Number(digits[10])
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
function dvCnpj(base: string, weights: number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i]
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false
  if (/^(\d)\1{13}$/.test(digits)) return false
  if (dvCnpj(digits.slice(0, 12), CNPJ_W1) !== Number(digits[12])) return false
  return dvCnpj(digits.slice(0, 13), CNPJ_W2) === Number(digits[13])
}

export function documentType(digits: string): DocumentType | null {
  if (isCpf(digits)) return 'CPF'
  if (isCnpj(digits)) return 'CNPJ'
  return null
}

export function normalizeDocument(raw: string): { digits: string; type: DocumentType } {
  const digits = digitsOnly(raw)
  const type = documentType(digits)
  if (!type) throw new InvalidDocumentError()
  return { digits, type }
}

/** Progressive INPUT mask 000.000.000-00. */
export function maskCpfInput(raw: string): string {
  const d = digitsOnly(raw ?? '').slice(0, 11)
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)]
  let s = p[0]
  if (p[1]) s += '.' + p[1]
  if (p[2]) s += '.' + p[2]
  if (p[3]) s += '-' + p[3]
  return s
}

/** INPUT mask for a field that accepts CPF OR CNPJ. */
export function maskDocumentInput(raw: string): string {
  const d = digitsOnly(raw ?? '').slice(0, 14)
  if (d.length <= 11) return maskCpfInput(d)
  let s = d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12)
  if (d.length > 12) s += '-' + d.slice(12, 14)
  return s
}

/** PRIVACY mask: only the last 2 digits are shown. Never an identifier. */
export function maskDocument(digits: string): string {
  const d = digitsOnly(digits)
  if (isCnpj(d)) return `**.***.***/****-${d.slice(12)}`
  if (d.length >= 2) return `***.***.***-${d.slice(-2)}`
  return '***'
}
