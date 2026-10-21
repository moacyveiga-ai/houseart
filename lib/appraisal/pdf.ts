// The appraisal PDF (A4): range, comparables, QR to /verify/HA-L-…, hash.
// Drawn once at issue and stored in the private vault.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export interface AppraisalPdfInput {
  code: string
  title: string
  year: number | null
  artist: string
  technique: string | null
  dimensions: string
  purpose: string
  minCents: bigint
  suggestedCents: bigint
  maxCents: bigint
  comparables: { label: string; dimensions: string | null; priceCents: bigint; soldOn: Date; source: string }[]
  methodology: string
  appraiserName: string
  issuedAt: Date
  contentHash: string
  verifyUrl: string
}

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?')
const brl = (c: bigint) => `R$ ${Number(c / 100n).toLocaleString('pt-BR')}`

export async function renderAppraisalPdf(i: AppraisalPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`HouseArt - Laudo de opiniao de valor ${i.code}`)
  doc.setCreationDate(i.issuedAt); doc.setModificationDate(i.issuedAt)
  const page = doc.addPage([595.28, 841.89])
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.067, 0.067, 0.067), muted = rgb(0.42, 0.4, 0.38), sand = rgb(0.85, 0.64, 0.25)
  const margin = 56
  let y = 780
  page.drawText('HouseArt', { x: margin, y, size: 18, font: serif, color: ink })
  page.drawText('LAUDO DE OPINIAO DE VALOR', { x: margin, y: y - 40, size: 10, font: bold, color: muted })
  page.drawText(i.code, { x: margin, y: y - 70, size: 26, font: serif, color: ink })
  page.drawLine({ start: { x: margin, y: y - 86 }, end: { x: 595.28 - margin, y: y - 86 }, thickness: 1, color: sand })
  y -= 116
  const row = (label: string, value: string) => {
    page.drawText(ascii(label).toUpperCase(), { x: margin, y, size: 8, font: bold, color: muted })
    page.drawText(ascii(value).slice(0, 90), { x: margin + 150, y, size: 11, font: sans, color: ink })
    y -= 22
  }
  row('Obra', `${i.title}${i.year ? `, ${i.year}` : ''}`)
  row('Artista', i.artist)
  row('Tecnica', i.technique ?? '-')
  row('Dimensoes', i.dimensions)
  row('Finalidade', i.purpose)
  row('Avaliador', i.appraiserName)
  row('Emitido em', i.issuedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }))
  y -= 8
  page.drawText('FAIXA DE VALOR', { x: margin, y, size: 8, font: bold, color: muted }); y -= 22
  const cols = [['Minimo', i.minCents], ['Sugerido', i.suggestedCents], ['Maximo', i.maxCents]] as const
  cols.forEach(([label, v], k) => {
    const x = margin + k * 160
    page.drawText(label, { x, y, size: 9, font: sans, color: muted })
    page.drawText(ascii(brl(v)), { x, y: y - 18, size: k === 1 ? 16 : 13, font: k === 1 ? bold : sans, color: ink })
  })
  y -= 54
  page.drawText('COMPARAVEIS', { x: margin, y, size: 8, font: bold, color: muted }); y -= 16
  if (i.comparables.length === 0) { page.drawText('Nenhum comparavel informado.', { x: margin, y, size: 9, font: sans, color: muted }); y -= 14 }
  for (const c of i.comparables.slice(0, 8)) {
    page.drawText(ascii(`${c.label}${c.dimensions ? ` · ${c.dimensions}` : ''} · ${brl(c.priceCents)} · ${c.soldOn.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })} · ${c.source}`).slice(0, 110), { x: margin, y, size: 9, font: sans, color: ink })
    y -= 14
  }
  y -= 8
  page.drawText('METODOLOGIA', { x: margin, y, size: 8, font: bold, color: muted }); y -= 14
  for (const line of wrap(ascii(i.methodology), 95).slice(0, 8)) { page.drawText(line, { x: margin, y, size: 9, font: sans, color: ink }); y -= 13 }
  y -= 10
  page.drawText('HASH DO CONTEUDO (SHA-256)', { x: margin, y, size: 8, font: bold, color: muted })
  page.drawText(i.contentHash.slice(0, 32), { x: margin, y: y - 14, size: 9, font: sans, color: ink })
  page.drawText(i.contentHash.slice(32), { x: margin, y: y - 26, size: 9, font: sans, color: ink })
  const qrPng = await QRCode.toBuffer(i.verifyUrl, { type: 'png', margin: 1, width: 240 })
  const qr = await doc.embedPng(qrPng)
  page.drawImage(qr, { x: 595.28 - margin - 110, y: 80, width: 110, height: 110 })
  page.drawText(ascii(i.verifyUrl), { x: margin, y: 84, size: 8, font: sans, color: muted })
  page.drawText('Opiniao de valor para a finalidade declarada. Nao substitui laudo pericial nem avaliacao judicial.', { x: margin, y: 60, size: 8, font: sans, color: muted })
  return doc.save()
}

function wrap(text: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > width) { out.push(line.trim()); line = w } else line = `${line} ${w}`
  }
  if (line.trim()) out.push(line.trim())
  return out
}
