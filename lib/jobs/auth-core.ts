// Núcleo PURO da autorização das rotas de job/cron (/api/jobs/*, /api/cron/*).
// Sem next, sem prisma, sem env — tudo entra por parâmetro, então dá pra testar
// as quatro combinações de ambiente sem subir servidor. O I/O (ler env, header
// e sessão) fica em ./auth.ts.
//
// A regra, em ordem:
//   1. `Authorization: Bearer <CRON_SECRET>` — o Vercel Cron injeta sozinho.
//   2. Sessão com alçada para o disparo manual — "Rodar agora" do
//      /backoffice/automacao, que roda no browser e não tem como carregar o
//      secret. A alçada é decidida em ./auth.ts (`ManualJobRule`: admin e
//      gestor por padrão, ou só admin — auditoria A-TEN-15; antes bastava
//      escopo total). SÓ por POST (QA geral, bloco B): por GET um
//      link qualquer aberto por alguém da equipe disparava o job com o cookie
//      dela (payouts-lote, billing-diario, publicar-agendados) — e o cookie de
//      sessão (SameSite=Lax) vai junto em navegação GET, não em POST cruzado.
//   3. Sem secret configurado, libera SÓ fora de produção (dev/test local).
//
// O item 3 é o que estava invertido: `if (!secret) return true` liberava as
// rotas para qualquer um em produção, porque a env CRON_SECRET não existia na
// Vercel. Agora falha FECHADO — produção sem secret nega.
import { timingSafeEqual } from 'node:crypto'

export type DecisaoJob = 'bearer' | 'staff' | 'dev-sem-secret' | 'negado'

export type ContextoJob = {
  /** Valor de process.env.CRON_SECRET (undefined/'' = não configurado). */
  secret?: string
  /** Header Authorization cru da requisição. */
  authorization?: string | null
  /**
   * Há sessão com alçada para disparar ESTE job à mão (regra do job em
   * ./auth.ts — admin/gestor por padrão, auditoria A-TEN-15)? O nome `staff`
   * ficou do tempo em que bastava escopo total.
   */
  staff: boolean
  /** Método HTTP. A sessão de staff só vale fora de GET/HEAD. */
  metodo: string
  /**
   * Ambiente produtivo. Preview da Vercel CONTA como produção (é público),
   * então isto é `NODE_ENV === 'production'`, não `VERCEL_ENV === 'production'`.
   */
  producao: boolean
}

/**
 * Compara em tempo constante. Vaza apenas o comprimento — padrão e aceitável;
 * o que não pode vazar é o conteúdo, byte a byte, para quem tenta adivinhar o
 * secret medindo o tempo de resposta.
 *
 * Exportada porque o webhook do BTG (lib/banking/webhook-auth.ts) segue a
 * mesma política e não deve carregar uma segunda cópia do primitivo.
 */
export function iguaisSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Credencial do cron. PURA e sem I/O de propósito: é checada ANTES da sessão
 * para que a rodada do cron não leia cookie nem abra conexão com o banco só
 * para se autenticar (manter o Neon acordado 24/7 esgota a cota mensal — foi a
 * causa da queda de 2026-07-18).
 */
export function bearerValido(secret: string | undefined, authorization: string | null | undefined): boolean {
  if (!secret) return false
  if (!authorization) return false
  return iguaisSeguro(authorization, `Bearer ${secret}`)
}

export function decidirAcessoJob(ctx: ContextoJob): DecisaoJob {
  if (bearerValido(ctx.secret, ctx.authorization)) return 'bearer'
  if (ctx.staff && ctx.metodo !== 'GET' && ctx.metodo !== 'HEAD') return 'staff'
  if (!ctx.secret && !ctx.producao) return 'dev-sem-secret'
  return 'negado'
}

export function acessoLiberado(ctx: ContextoJob): boolean {
  return decidirAcessoJob(ctx) !== 'negado'
}
