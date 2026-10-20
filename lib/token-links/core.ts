// Régua única de validade dos links por token (auditoria 2026-10-11, A-TEN-08/09,
// decisões Q13/Q14 do Moacy): todo link público vale 30 dias a partir da
// EMISSÃO, e um link revogado deixa de abrir na hora.
//
// Núcleo puro (sem banco, sem relógio): quem chama passa o `now`. Usado pelo
// link de assinatura (`lib/assinaturas/link-server.ts`) e pelos links de
// compra e de agenda. Cada módulo diz o que é "emissão" para a sua linha
// (`enviadoEm`, `tokenIssuedAt`, `createdAt`), esta régua só compara.

export const TOKEN_LINK_TTL_DAYS = 30
export const TOKEN_LINK_TTL_MS = TOKEN_LINK_TTL_DAYS * 24 * 60 * 60 * 1000

export type TokenLinkState = 'open' | 'expired' | 'revoked'

export interface TokenLinkFacts {
  /** Quando o link foi emitido (o prazo conta daqui). */
  issuedAt: Date
  /** Quando foi revogado, se foi. */
  revokedAt?: Date | null
}

/**
 * Estado do link em `now`. Revogado ganha de vencido. Abre enquanto
 * `now − issuedAt < 30 dias`: no dia 30 exato, fecha.
 */
export function tokenLinkState(link: TokenLinkFacts, now: Date): TokenLinkState {
  // Revogação com data no futuro (relógio torto) ainda não vale.
  if (link.revokedAt && link.revokedAt.getTime() <= now.getTime()) return 'revoked'
  return now.getTime() - link.issuedAt.getTime() < TOKEN_LINK_TTL_MS ? 'open' : 'expired'
}

export function isTokenLinkOpen(link: TokenLinkFacts, now: Date): boolean {
  return tokenLinkState(link, now) === 'open'
}

/**
 * Emissão do link de uma linha que guarda `tokenIssuedAt` (jornada de compra,
 * compromisso): a coluna, ou `createdAt` na linha anterior à coluna (nula).
 */
export function issuedAtOf(row: { tokenIssuedAt?: Date | null; createdAt: Date }): Date {
  return row.tokenIssuedAt ?? row.createdAt
}

/** O link da linha (com `tokenIssuedAt` ou `createdAt`) abre em `now`? */
export function isRowTokenLinkOpen(row: { tokenIssuedAt?: Date | null; createdAt: Date }, now: Date): boolean {
  return isTokenLinkOpen({ issuedAt: issuedAtOf(row) }, now)
}
