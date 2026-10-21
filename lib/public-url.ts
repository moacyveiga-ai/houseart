// URL pública canônica do app — a base de TODO link absoluto que sai da
// casa: WhatsApp (`/entrar/<token>`, portal das partes), e-mails e o
// `redirectTo` do Supabase Auth (revisão F2, lote C). Módulo PURO: lê só o
// recorte de `process.env` que recebe, sem next e sem request.
//
// Precedência: `APP_URL` → `NEXT_PUBLIC_APP_URL` → `https://<URL de
// produção da Vercel>` → `http://localhost:3008`. Nunca a origem da request
// (o `nextUrl` da requisição, cabeçalho Host): na Vercel o Host é aceito como
// veio, e um link de redefinição de senha montado sobre ele apontaria para
// qualquer alias do deploy que o atacante colocasse no cabeçalho. Em
// produção `APP_URL` (ou `NEXT_PUBLIC_APP_URL`) é obrigatória — o fallback
// da Vercel é o cinto, o de localhost é só dev.

/** O recorte de `process.env` que este módulo lê. Tudo opcional de propósito. */
export interface PublicUrlEnv {
  APP_URL?: string
  NEXT_PUBLIC_APP_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
  /** `process.env` tem índice; sem isto o TS recusa passá-lo a um tipo só de opcionais. */
  [outra: string]: string | undefined
}

export const PUBLIC_URL_DEV = 'http://localhost:3008'

/**
 * Base pública do app, sem barra final, ou null quando nada a declara — para
 * quem prefere mandar o e-mail SEM link a mandá-lo apontando para localhost.
 */
export function declaredPublicUrl(env: PublicUrlEnv = process.env): string | null {
  // Cada nome aparado ANTES de escolher: `APP_URL=' '` não mascara o outro.
  const explicita = [env.APP_URL, env.NEXT_PUBLIC_APP_URL].map(v => (v ?? '').trim()).find(Boolean)
  if (explicita) return explicita.replace(/\/$/, '')
  const vercel = (env.VERCEL_PROJECT_PRODUCTION_URL || '').trim()
  if (vercel) return `https://${vercel}`
  return null
}

/**
 * Os hosts dos DOIS nomes declarados (não só o que vence a precedência): para
 * aceitar link que aponta para o próprio app (lib/payouts/rotas-core.ts). URL
 * malformada é ignorada.
 */
export function publicUrlHosts(env: PublicUrlEnv = process.env): string[] {
  const hosts: string[] = []
  for (const v of [env.APP_URL, env.NEXT_PUBLIC_APP_URL]) {
    if (!v?.trim()) continue
    try { hosts.push(new URL(v.trim()).hostname.toLowerCase()) } catch { /* malformada: ignora */ }
  }
  return hosts
}

/** Base pública do app, sem barra final. Nunca vazia (fora da Vercel e sem env, localhost). */
export function publicBaseUrl(env: PublicUrlEnv = process.env): string {
  return declaredPublicUrl(env) ?? PUBLIC_URL_DEV
}
