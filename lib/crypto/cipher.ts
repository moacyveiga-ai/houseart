// Document protection at rest. Two representations:
//   • enc  (AES-256-GCM)            → the secret itself, reversible only with the key
//   • hash (HMAC-SHA256 + pepper)   → deterministic, for equality SEARCH, not reversible
// Secrets from the environment (configured by the owner, NEVER by the agent):
//   DOCUMENT_CIPHER_KEYS = "id:base64(32 bytes)[,id2:base64…]" (1st = active; all decrypt → rotation)
//   DOCUMENT_HASH_PEPPER = the HMAC secret
// In production the absence is an ERROR. Elsewhere a derived DEV key is used (warns once).
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto'
import { InvalidDocumentError, maskDocument, normalizeDocument, type DocumentType } from './document'

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
type Key = { id: string; bytes: Buffer }

let warnedDev = false
const devBytes = () => scryptSync('houseart-document-cipher-dev', 'houseart-dev-salt', 32)
function devKey(): Key {
  if (!warnedDev) {
    console.warn('[crypto] DOCUMENT_CIPHER_KEYS ausente — usando chave de DESENVOLVIMENTO. Não use com documento real.')
    warnedDev = true
  }
  return { id: 'dev', bytes: devBytes() }
}

function parseKey(entry: string): Key {
  const sep = entry.indexOf(':')
  if (sep <= 0) throw new Error('DOCUMENT_CIPHER_KEYS mal formatado: falta o prefixo "id:" antes do base64 (ex.: k1:$(openssl rand -base64 32))')
  const id = entry.slice(0, sep).trim()
  const bytes = Buffer.from(entry.slice(sep + 1).trim(), 'base64')
  if (!id || bytes.length !== 32) throw new Error(`DOCUMENT_CIPHER_KEYS: a chave "${id || '?'}" decodifica em ${bytes.length} bytes (esperado 32)`)
  return { id, bytes }
}

let cacheKeysRaw: string | undefined
let cacheKeys: Key[] | undefined
function keys(): Key[] {
  const raw = process.env.DOCUMENT_CIPHER_KEYS?.trim() || ''
  if (raw && raw === cacheKeysRaw && cacheKeys) return cacheKeys
  let result: Key[]
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('DOCUMENT_CIPHER_KEYS ausente em produção')
    result = [devKey()]
  } else {
    result = raw.split(',').filter(Boolean).map(parseKey)
    if (result.length === 0) throw new Error('DOCUMENT_CIPHER_KEYS vazio')
    if (new Set(result.map((k) => k.id)).size !== result.length) throw new Error('DOCUMENT_CIPHER_KEYS com ids repetidos')
  }
  cacheKeysRaw = raw
  cacheKeys = result
  return result
}

let cachePepperRaw: string | undefined
let cachePepper: Buffer | undefined
function pepper(): Buffer {
  const raw = process.env.DOCUMENT_HASH_PEPPER?.trim() || ''
  if (raw && raw === cachePepperRaw && cachePepper) return cachePepper
  let bytes: Buffer
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('DOCUMENT_HASH_PEPPER ausente em produção')
    bytes = scryptSync('houseart-document-pepper-dev', 'houseart-dev-salt', 32)
  } else bytes = Buffer.from(raw, 'utf8')
  cachePepperRaw = raw
  cachePepper = bytes
  return bytes
}

/** Deterministic HMAC-SHA256 of the digits (equality search). */
export function hashDocument(digits: string): string {
  return createHmac('sha256', pepper()).update(`document:${VERSION}:${digits}`).digest('hex')
}

/** Generic keyed hash for other secrets (tokens of one use, e-mails) with a domain label. */
export function keyedHash(domain: string, value: string): string {
  return createHmac('sha256', pepper()).update(`${domain}:${VERSION}:${value}`).digest('hex')
}

/** Encrypts with the ACTIVE key. Envelope `v1:<keyId>:<iv>:<tag>:<ct>` (base64url). */
export function encryptText(plain: string): string {
  const key = keys()[0]
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key.bytes, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const b64 = (b: Buffer) => b.toString('base64url')
  return [VERSION, key.id, b64(iv), b64(tag), b64(ct)].join(':')
}

export function decryptText(envelope: string): string {
  const parts = envelope.split(':')
  if (parts.length !== 5 || parts[0] !== VERSION) throw new Error('envelope inválido')
  const [, keyId, ivB64, tagB64, ctB64] = parts
  const key = keys().find((k) => k.id === keyId)
  if (!key) throw new Error(`chave "${keyId}" indisponível para decifrar`)
  const decipher = createDecipheriv(ALGO, key.bytes, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8')
}

export interface ProtectedDocument { type: DocumentType; hash: string; enc: string; mask: string }

/** Normalize + validate + protect a raw CPF/CNPJ. The ONLY sanctioned way to store one. */
export function protectDocument(raw: string): ProtectedDocument {
  const { digits, type } = normalizeDocument(raw)
  return { type, hash: hashDocument(digits), enc: encryptText(digits), mask: maskDocument(digits) }
}

/** Only the search hash (to query without storing). */
export function documentSearchHash(raw: string): string {
  return hashDocument(normalizeDocument(raw).digits)
}

/** Reveals the digits. Restricted and audited use (never in a log). */
export function revealDocument(enc: string): string {
  return decryptText(enc)
}

export function activeKeyIsDev(): boolean {
  const active = keys()[0]
  return active.id === 'dev' || active.bytes.equals(devBytes())
}

export { InvalidDocumentError }
