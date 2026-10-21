// The certificate PDF (A4): header, public id, artwork, artist, masked
// holder, QR to /verify/[publicId], content hash. Drawn ONCE at issue and
// stored; downloads hand the stored bytes. pdf-lib only (no fonts fetched).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export interface CertificatePdfInput {
  publicId: string
  title: string
  year: number | null
  artist: string
  technique: string | null
  dimensions: string
  holderName: string
  holderMask: string | null
  issuedAt: Date
  contentHash: string
  verifyUrl: string
  timestampLine: string
}

function ascii(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?')
}

export async function renderCertificatePdf(i: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`HouseArt - Escritura da obra ${i.publicId}`)
  doc.setCreationDate(i.issuedAt); doc.setModificationDate(i.issuedAt)
  const page = doc.addPage([595.28, 841.89])
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.067, 0.067, 0.067), muted = rgb(0.42, 0.4, 0.38), sand = rgb(0.85, 0.64, 0.25)
  const margin = 56
  let y = 780
  page.drawRectangle({ x: margin, y: y - 2, width: 14, height: 18, borderColor: ink, borderWidth: 1.5 })
  page.drawRectangle({ x: margin + 8, y: y + 10, width: 6, height: 6, color: ink })
  page.drawText('HouseArt', { x: margin + 22, y, size: 18, font: serif, color: ink })
  page.drawText('ESCRITURA DA OBRA DE ARTE', { x: margin, y: y - 40, size: 10, font: bold, color: muted })
  page.drawText(i.publicId, { x: margin, y: y - 70, size: 28, font: serif, color: ink })
  page.drawLine({ start: { x: margin, y: y - 86 }, end: { x: 595.28 - margin, y: y - 86 }, thickness: 1, color: sand })
  y -= 120
  const row = (label: string, value: string) => {
    page.drawText(ascii(label).toUpperCase(), { x: margin, y, size: 8, font: bold, color: muted })
    page.drawText(ascii(value), { x: margin + 150, y, size: 12, font: sans, color: ink })
    y -= 26
  }
  row('Obra', `${i.title}${i.year ? `, ${i.year}` : ''}`)
  row('Artista', i.artist)
  row('Tecnica', i.technique ?? '-')
  row('Dimensoes', i.dimensions)
  row('Titular', `${i.holderName}${i.holderMask ? ` - CPF ${i.holderMask}` : ''}`)
  row('Emitida em', i.issuedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }))
  row('Carimbo do tempo', i.timestampLine)
  y -= 10
  page.drawText('HASH DO CONTEUDO (SHA-256)', { x: margin, y, size: 8, font: bold, color: muted })
  page.drawText(i.contentHash.slice(0, 32), { x: margin, y: y - 14, size: 9, font: sans, color: ink })
  page.drawText(i.contentHash.slice(32), { x: margin, y: y - 26, size: 9, font: sans, color: ink })
  const qrPng = await QRCode.toBuffer(i.verifyUrl, { type: 'png', margin: 1, width: 240 })
  const qr = await doc.embedPng(qrPng)
  page.drawImage(qr, { x: 595.28 - margin - 120, y: 120, width: 120, height: 120 })
  page.drawText('Verifique em', { x: 595.28 - margin - 120, y: 106, size: 8, font: sans, color: muted })
  page.drawText(ascii(i.verifyUrl), { x: 595.28 - margin - 120, y: 94, size: 7, font: sans, color: ink })
  page.drawText('Este documento registra a titularidade da obra na HouseArt. Mudancas futuras viram novos eventos na cadeia de titularidade.', { x: margin, y: 70, size: 8, font: sans, color: muted, maxWidth: 480 })
  return doc.save()
}
