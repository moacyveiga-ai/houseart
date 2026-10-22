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

/** Progressive mask while typing: "(71) 99999-0000". */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
