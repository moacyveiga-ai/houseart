// SMS — pure helpers: Brazilian mobile normalization to E.164 and the mask.
export function normalizeBrMobile(raw: string): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length !== 11 || d[2] !== '9') return null
  if (!/^[1-9]{2}9\d{8}$/.test(d)) return null
  return `+55${d}`
}

/** "+5571999990000" → "(71) 99999-0000" */
export function maskPhone(e164: string | null | undefined): string {
  const d = (e164 ?? '').replace(/\D/g, '')
  const n = d.startsWith('55') ? d.slice(2) : d
  if (n.length !== 11) return e164 ?? ''
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

/**
 * Tidies a phone of the public contacts when the field loses focus (never on each key — that
 * would rewrite an extension, a 0800 or a number abroad while it is typed): only a value made of
 * digits and the usual separators with DDD + 8 or 9 digits becomes "(71) 3333-0000" /
 * "(71) 99999-0000"; anything else (ramal, 0800, +55, 4004-1234) stays exactly as typed.
 */
export function tidyPhone(raw: string): string {
  if (!/^[\d\s().-]+$/.test(raw.trim())) return raw
  const d = raw.replace(/\D/g, '')
  if ((d.length !== 10 && d.length !== 11) || d[0] === '0') return raw
  return d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Progressive mask while typing: "(71) 99999-0000". */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
