// The detail of a review item (Admin · Obras e certificados › item) — PURE.
// What the desk needs before deciding: the work, its certificate, and the
// context of the kind (the lookalike, the tag reads, the reported conversation).
import type { ReviewKind } from './core'

export const CERTIFICATE_STATUS_LABELS: Record<string, string> = { DRAFT: 'Em preparo', ACTIVE: 'Ativo', CONTESTED: 'Contestado', REVOKED: 'Revogado' }
export const SEAL_LABELS: Record<string, string> = { NONE: 'Sem selo', YELLOW: 'Selo amarelo', GREEN: 'Selo verde' }

/** "91% semelhante" from basis points. */
export function similarityLabel(bps: number): string {
  return `${Math.round(Math.max(0, Math.min(10_000, bps)) / 100)}% semelhante`
}

/** The heading of the context block of each kind. */
export const CONTEXT_TITLES: Record<ReviewKind, string> = {
  DUPLICATE: 'Obra parecida, de outra conta',
  CONTESTATION: 'Texto da contestação',
  NEW_ISSUER: 'Primeiro envio da conta',
  MARKER_REMOVED: 'Leituras da etiqueta',
  EXPORT_RESTRICTION: 'Restrição de exportação',
  MESSAGE_REPORT: 'Conversa denunciada',
}

/** The certificate line: "Ativo · assinado 12/10 · emitido 13/10" (dates already formatted). */
export function certificateLine(c: { status: string; signedOn: string | null; issuedOn: string | null } | null): string {
  if (!c) return 'Sem certificado'
  return [CERTIFICATE_STATUS_LABELS[c.status] ?? c.status, c.signedOn ? `assinado ${c.signedOn}` : 'não assinado', c.issuedOn ? `emitido ${c.issuedOn}` : null].filter(Boolean).join(' · ')
}
