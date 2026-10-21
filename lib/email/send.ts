// Transactional e-mail — ONE door. With SMTP_URL it goes out by nodemailer;
// without it (dev, CI) the message is logged WITHOUT the body's secrets:
// callers pass `redactedPreview` for the log. Never throws to the caller's
// user: returns the status.
import nodemailer from 'nodemailer'

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
  html?: string
  /** what may be logged in dev (no codes, no links) */
  redactedPreview?: string
}

export type SendStatus = 'SENT' | 'LOGGED' | 'FAILED' | 'INVALID_RECIPIENT'

const RESERVED_DOMAIN = /@[^@]*\.(local|localhost)$/i

export async function sendEmail(mail: OutgoingEmail): Promise<SendStatus> {
  if (RESERVED_DOMAIN.test(mail.to)) return 'INVALID_RECIPIENT'
  const url = process.env.SMTP_URL?.trim()
  const from = process.env.SMTP_FROM?.trim() || 'HouseArt <no-reply@houseart.com.br>'
  if (!url) {
    console.log(`[email] (sem SMTP_URL) para ${mail.to}: ${mail.subject} — ${mail.redactedPreview ?? ''}`)
    if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_ECHO === '1') console.log(mail.text)
    return 'LOGGED'
  }
  try {
    const transport = nodemailer.createTransport(url)
    await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html })
    return 'SENT'
  } catch (e) {
    console.error('[email] falha ao enviar:', e instanceof Error ? e.name : e)
    return 'FAILED'
  }
}
