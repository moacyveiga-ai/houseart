// NTAG 424 DNA Secure Unique NFC (SUN) message verification — PURE crypto.
//   · AES-128 CMAC (RFC 4493) over the session vector SV2 = 3CC3 0001 0080 || UID || CTR(LE)
//     with the tag's diversified key; the message MAC is CMAC(Ks, '') truncated to the 8 even bytes.
//   · Diversified key = CMAC(master, 0x01 || UID || 'HouseArt') (NXP AN10922 style).
//   · Replay: the counter must exceed the last stored counter.
// `MARKER_VENDOR=mock` keeps the SAME maths with a development master key, so
// the app/tests can produce valid messages with `mockSunMessage`.
import { createCipheriv, scryptSync } from 'node:crypto'

function aesEcb(key: Buffer, block: Buffer): Buffer {
  const c = createCipheriv('aes-128-ecb', key, null)
  c.setAutoPadding(false)
  return Buffer.concat([c.update(block), c.final()])
}

function shiftLeft(b: Buffer): Buffer {
  const out = Buffer.alloc(b.length)
  let carry = 0
  for (let i = b.length - 1; i >= 0; i--) {
    out[i] = ((b[i] << 1) & 0xff) | carry
    carry = b[i] & 0x80 ? 1 : 0
  }
  return out
}

function subkeys(key: Buffer): { k1: Buffer; k2: Buffer } {
  const l = aesEcb(key, Buffer.alloc(16))
  const k1 = shiftLeft(l)
  if (l[0] & 0x80) k1[15] ^= 0x87
  const k2 = shiftLeft(k1)
  if (k1[0] & 0x80) k2[15] ^= 0x87
  return { k1, k2 }
}

/** AES-128 CMAC (RFC 4493). */
export function aesCmac(key: Buffer, message: Buffer): Buffer {
  if (key.length !== 16) throw new Error('aesCmac: 16-byte key')
  const { k1, k2 } = subkeys(key)
  const n = message.length === 0 ? 1 : Math.ceil(message.length / 16)
  const lastComplete = message.length > 0 && message.length % 16 === 0
  let x: Buffer = Buffer.alloc(16)
  for (let i = 0; i < n - 1; i++) {
    const block = message.subarray(i * 16, i * 16 + 16)
    x = aesEcb(key, xor(x, block))
  }
  let last: Buffer
  if (lastComplete) last = xor(message.subarray((n - 1) * 16), k1)
  else {
    const rest = message.subarray((n - 1) * 16)
    const padded = Buffer.alloc(16)
    rest.copy(padded); padded[rest.length] = 0x80
    last = xor(padded, k2)
  }
  return aesEcb(key, xor(x, last))
}

function xor(a: Uint8Array, b: Uint8Array): Buffer {
  const out = Buffer.alloc(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

/** The 7-byte UID as a Buffer (lowercase hex, 14 chars). */
export function uidBytes(uidHex: string): Buffer {
  if (!/^[0-9a-f]{14}$/i.test(uidHex)) throw new Error('uid must be 7 bytes hex')
  return Buffer.from(uidHex, 'hex')
}

/** Diversified tag key from the master key and the UID. */
export function diversifiedKey(master: Buffer, uidHex: string): Buffer {
  return aesCmac(master, Buffer.concat([Buffer.from([0x01]), uidBytes(uidHex), Buffer.from('HouseArt', 'utf8')]))
}

export function sunMac(tagKey: Buffer, uidHex: string, counter: number): string {
  const ctr = Buffer.alloc(3)
  ctr[0] = counter & 0xff; ctr[1] = (counter >> 8) & 0xff; ctr[2] = (counter >> 16) & 0xff
  const sv2 = Buffer.concat([Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]), uidBytes(uidHex), ctr])
  const ks = aesCmac(tagKey, sv2)
  const full = aesCmac(ks, Buffer.alloc(0))
  const truncated = Buffer.from([full[1], full[3], full[5], full[7], full[9], full[11], full[13], full[15]])
  return truncated.toString('hex').toUpperCase()
}

export type SunVerdict = { ok: true } | { ok: false; reason: 'BAD_UID' | 'BAD_COUNTER' | 'REPLAY' | 'BAD_CMAC' }

export function verifySun(opt: { master: Buffer; uid: string; counter: number; cmac: string; lastCounter: number }): SunVerdict {
  if (!/^[0-9a-f]{14}$/i.test(opt.uid)) return { ok: false, reason: 'BAD_UID' }
  if (!Number.isInteger(opt.counter) || opt.counter < 0 || opt.counter > 0xffffff) return { ok: false, reason: 'BAD_COUNTER' }
  if (opt.counter <= opt.lastCounter) return { ok: false, reason: 'REPLAY' }
  const expected = sunMac(diversifiedKey(opt.master, opt.uid.toLowerCase()), opt.uid.toLowerCase(), opt.counter)
  if (expected !== opt.cmac.toUpperCase() || !/^[0-9A-F]{16}$/.test(opt.cmac)) return { ok: false, reason: 'BAD_CMAC' }
  return { ok: true }
}

/** The tamper flag only counts on an authenticated read: the `tt` bit travels in the URL and is not
 *  covered by the CMAC here, so a forged link with `tt=1` must not revoke a linked tag. */
export function tamperOf(reported: boolean, verdict: SunVerdict): boolean {
  return reported && verdict.ok
}

/** Development master key (MARKER_VENDOR=mock): derived, never a real tag key. */
export function mockMasterKey(): Buffer {
  return scryptSync('houseart-marker-master-dev', 'houseart-marker-salt', 16)
}

/** A valid SUN message for the mock vendor (what the test/app hands to /api/markers/link). */
export function mockSunMessage(uid: string, counter: number): { uid: string; ctr: number; cmac: string } {
  return { uid: uid.toLowerCase(), ctr: counter, cmac: sunMac(diversifiedKey(mockMasterKey(), uid.toLowerCase()), uid.toLowerCase(), counter) }
}
