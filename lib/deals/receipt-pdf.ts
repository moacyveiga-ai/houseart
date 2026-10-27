// The receipt PDF (A4) of a completed deal, drawn on request from the rows of receipt-core.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Receipt } from './receipt-core'

// The standard fonts are WinAnsi: accents survive, other glyphs become "?"
const safe = (s: string) => s.replace(/[−–—]/g, '-').replace(/[^\x20-\x7e -ÿ]/g, '?')

export async function renderReceiptPdf(r: Receipt, issuedAt: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`HouseArt - ${safe(r.title)}`)
  doc.setCreationDate(issuedAt); doc.setModificationDate(issuedAt)
  const page = doc.addPage([595.28, 841.89])
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.067, 0.067, 0.067), muted = rgb(0.42, 0.4, 0.38), sand = rgb(0.85, 0.64, 0.25)
  const margin = 56, right = 595.28 - margin
  let y = 780
  page.drawText('HouseArt', { x: margin, y, size: 18, font: serif, color: ink })
  page.drawText(safe(r.title).toUpperCase(), { x: margin, y: y - 40, size: 10, font: bold, color: muted })
  page.drawLine({ start: { x: margin, y: y - 56 }, end: { x: right, y: y - 56 }, thickness: 1, color: sand })
  y -= 86
  for (const h of r.head) {
    page.drawText(safe(h.label).toUpperCase(), { x: margin, y, size: 8, font: bold, color: muted })
    page.drawText(safe(h.value).slice(0, 80), { x: margin + 150, y, size: 11, font: sans, color: ink })
    y -= 22
  }
  y -= 12
  page.drawText('VALORES', { x: margin, y, size: 8, font: bold, color: muted }); y -= 22
  for (const m of r.money) {
    const font = m.strong ? bold : sans
    const value = safe(m.value)
    page.drawText(safe(m.label).slice(0, 70), { x: margin, y, size: 11, font, color: ink })
    page.drawText(value, { x: right - font.widthOfTextAtSize(value, 11), y, size: 11, font, color: ink })
    y -= 22
  }
  y -= 14
  for (const line of wrap(safe(r.note), 100)) { page.drawText(line, { x: margin, y, size: 9, font: sans, color: muted }); y -= 13 }
  page.drawText(safe(`Emitido em ${issuedAt.toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}`), { x: margin, y: 56, size: 8, font: sans, color: muted })
  return doc.save()
}

function wrap(text: string, width: number): string[] {
  const out: string[] = []; let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > width) { out.push(line.trim()); line = w } else line += ' ' + w
  }
  if (line.trim()) out.push(line.trim())
  return out
}
