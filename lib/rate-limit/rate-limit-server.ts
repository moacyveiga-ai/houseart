// ════════════════════════════════════════════════════════════════════════════
//  Rate limit — STORE partilhado no Postgres (tabela rate_limit_bucket)
// ────────────────────────────────────────────────────────────────────────────
//  Por que no banco e não em memória: o limitador em memória
//   é POR INSTÂNCIA — com N instâncias
//  da Vercel o teto real é N × limite, e some no cold start .
//  Aqui um só balde por chave vale para todas.
//
//  Atomicidade — a corrida de duas requests: `consume` roda numa transação
//  curta que (1) cria o balde se não existe (`createMany` + skipDuplicates =
//  INSERT … ON CONFLICT DO NOTHING; o segundo inserter espera o primeiro
//  confirmar), (2) lê a linha com SELECT … FOR UPDATE — quem chega depois
//  fica na fila da linha e lê o estado já atualizado — e (3) grava o estado
//  que o núcleo puro decidiu. N tentativas em paralelo contra o mesmo balde
//  passam EXATAMENTE `limit` (lib/rate-limit/rate-limit.integration.test.ts).
//  Sem retry, sem CAS: o lock de linha é a fila.
//
//  Falha do banco: `consume` LANÇA (o login sem banco não entra de qualquer
//  forma); `consumeOrAllow` é a variante fail-open para as rotas públicas
//  que hoje funcionam sem banco (CEP, upload) — um Postgres indisponível não
//  pode virar a primeira coisa que barra um formulário público. Loga e deixa
//  passar.
// ════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { decide, type BucketState, type RateLimitDecision, type RateLimitPolicy } from './rate-limit-core'

export interface ConsumeOptions extends RateLimitPolicy {
  /** `<escopo>:<dimensão>:<valor>` — sem PII em claro (credencial passa por `hashKeyPart`). */
  key: string
  /** Relógio injetável (teste). */
  now?: Date
}

/** Teto da chave — o IP já vem cortado (`MAX_IP`), mas a chave é índice e não vira vetor de memória. */
const MAX_KEY = 200

type Row = { count: number; windowStartedAt: Date; blockedUntil: Date | null }

/** sha256 hex de um pedaço de chave que carregaria PII (e-mail, CPF). */
export function hashKeyPart(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Registra UMA tentativa no balde `key` e diz se ela passa. Atômico entre
 * instâncias (ver cabeçalho). Lança se o banco falhar.
 */
export async function consume(opts: ConsumeOptions): Promise<RateLimitDecision> {
  const key = opts.key.slice(0, MAX_KEY)
  const now = opts.now ?? new Date()
  const policy: RateLimitPolicy = { limit: opts.limit, windowMs: opts.windowMs, blockMs: opts.blockMs }

  return prisma.$transaction(async (tx) => {
    await tx.rateLimitBucket.createMany({
      data: [{ key, count: 0, windowStartedAt: now, blockedUntil: null }],
      skipDuplicates: true,
    })
    const rows = await tx.$queryRaw<Row[]>`
      SELECT "count", "windowStartedAt", "blockedUntil"
      FROM "rate_limit_bucket" WHERE "key" = ${key} FOR UPDATE
    `
    const row = rows[0]
    // count 0 = linha recém-criada (por esta ou por outra request que ainda
    // não decidiu): para o núcleo é balde inédito.
    const state: BucketState | null = row && row.count > 0 ? row : null
    const decision = decide(state, policy, now)
    if (decision.state !== state) {
      await tx.rateLimitBucket.update({
        where: { key },
        data: {
          count: decision.state.count,
          windowStartedAt: decision.state.windowStartedAt,
          blockedUntil: decision.state.blockedUntil,
        },
      })
    }
    return decision
  }).then(async (decision) => {
    if (Math.random() < 0.01) await prune(now)
    return decision
  })
}

/**
 * `consume` fail-open: se o store falhar, loga e responde como permitida
 * (remaining desconhecido = `limit`). Para rotas públicas que não dependem
 * do banco para funcionar. NUNCA para login/senha.
 */
export async function consumeOrAllow(opts: ConsumeOptions): Promise<RateLimitDecision> {
  try {
    return await consume(opts)
  } catch (e) {
    const now = opts.now ?? new Date()
    // Fail-open SÓ quando o banco está FORA (conexão). Um timeout de
    // transação/pool/lock (P2024/P2028/P2034, P1002/P1008) é o banco LENTO — e
    // o que o deixa lento é a própria enxurrada que o freio devia segurar:
    // nesse caso recusa (revisão da Fase 3, 2026-09-21).
    if (storeDown(e)) {
      console.error('[rate-limit] store fora do ar — deixando passar:', e instanceof Error ? e.message : e)
      return { allowed: true, state: { count: 0, windowStartedAt: now, blockedUntil: null }, remaining: opts.limit }
    }
    console.error('[rate-limit] store lento ou erro inesperado — recusando:', e instanceof Error ? e.message : e)
    return { allowed: false, state: { count: opts.limit, windowStartedAt: now, blockedUntil: null }, retryAfterMs: 5_000 }
  }
}

/**
 * "Fora do ar" = erro de CONEXÃO, não de tempo. O Prisma põe P10xx em
 * `errorCode` (PrismaClientInitializationError), não em `code`; com os
 * driver adapters (pg/neon) a queda chega como erro de socket (ECONNREFUSED…)
 * ou SQLSTATE da classe 08/57P (`code` do pg). P1002/P1008 são timeouts —
 * ficam de fora de propósito.
 */
export function storeDown(e: unknown): boolean {
  const o = (e ?? {}) as { code?: unknown; errorCode?: unknown }
  const errorCode = typeof o.errorCode === 'string' ? o.errorCode : ''
  const code = typeof o.code === 'string' ? o.code : ''
  if (/^(P1000|P1001|P1010|P1011|P1017)$/.test(errorCode) || /^(P1000|P1001|P1010|P1011|P1017)$/.test(code)) return true
  if (/^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|EPIPE)$/.test(code)) return true
  if (/^08[0-9A-Z]{3}$|^57P0[1-3]$/.test(code)) return true
  return false
}

/**
 * Poda oportunista (F1 da revisão da Fase 3): uma linha por chave vista,
 * inclusive credenciais inexistentes — sem poda, o ataque que o freio segura é
 * o que enche a tabela. Chamada por `consume` em ~1 % das vezes; apaga até
 * 500 linhas paradas há mais de 24 h e sem bloqueio vivo (24 h > qualquer
 * janela/bloqueio das políticas atuais). Erro não sobe.
 */
export async function prune(now = new Date()): Promise<number> {
  const limite = new Date(now.getTime() - 24 * 60 * 60_000)
  try {
    const r = await prisma.$executeRaw`DELETE FROM "rate_limit_bucket" WHERE "key" IN (SELECT "key" FROM "rate_limit_bucket" WHERE "updatedAt" < ${limite} AND ("blockedUntil" IS NULL OR "blockedUntil" < ${now}) LIMIT 500)`
    return Number(r)
  } catch (e) {
    console.error('[rate-limit] poda falhou:', e instanceof Error ? e.message : e)
    return 0
  }
}

/** Zera o balde (sucesso de login/troca de senha): apaga a linha. Falha do banco não sobe — o freio só fica mais conservador. */
export async function reset(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key: key.slice(0, MAX_KEY) } }).catch((e: unknown) => {
    console.error('[rate-limit] reset falhou:', e instanceof Error ? e.message : e)
  })
}
