// ════════════════════════════════════════════════════════════════════════════
//  Rate limit — NÚCLEO PURO (sem prisma, sem relógio, sem env)
// ────────────────────────────────────────────────────────────────────────────
//  Decide, para UM balde, se a tentativa de agora passa e qual é o estado
//  seguinte. Janela FIXA (não deslizante): a primeira tentativa abre a
//  janela, as próximas contam dentro dela, e quem chega com a janela vencida
//  abre outra. Estourou o limite → recusa; com `blockMs` > 0 a recusa vira
//  BLOQUEIO por esse tempo (o relógio da janela deixa de importar até ele
//  soltar); com `blockMs` = 0 a recusa dura só o resto da janela.
//
//  Enquanto o balde está bloqueado a tentativa NÃO conta nem prorroga: um
//  bloqueio que se estendesse a cada batida seria a arma perfeita para
//  trancar a conta de outra pessoa para sempre (negação de serviço por
//  credencial). O bloqueio é fixo, e é o mesmo para IP e para conta.
//
//  A persistência (lib/rate-limit/rate-limit-server.ts) só aplica o estado
//  que sai daqui, sob lock de linha — a corrida entre duas requests é
//  resolvida lá, não aqui.
// ════════════════════════════════════════════════════════════════════════════

export interface BucketState {
  count: number
  windowStartedAt: Date
  blockedUntil: Date | null
}

export interface RateLimitPolicy {
  /** Tentativas que PASSAM por janela (a `limit + 1`-ésima é recusada). */
  limit: number
  windowMs: number
  /** 0 (padrão) = recusa só até a janela vencer; > 0 = bloqueia por este tempo ao estourar. */
  blockMs?: number
}

export type RateLimitDecision =
  | { allowed: true; state: BucketState; remaining: number }
  | { allowed: false; state: BucketState; retryAfterMs: number }

/** `Retry-After` em segundos inteiros — nunca 0 (o cliente leria "tente já"). */
export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000))
}

/**
 * A decisão. `state` null = balde inédito. O `state` devolvido é o que deve
 * ser persistido (igual ao de entrada quando nada muda — recusa bloqueada).
 */
export function decide(state: BucketState | null, policy: RateLimitPolicy, now: Date): RateLimitDecision {
  const blockMs = policy.blockMs ?? 0
  const nowMs = now.getTime()

  // 1. Bloqueado: recusa sem tocar o balde.
  if (state?.blockedUntil && state.blockedUntil.getTime() > nowMs) {
    return { allowed: false, state, retryAfterMs: state.blockedUntil.getTime() - nowMs }
  }

  // 2. Inédito, janela vencida ou bloqueio recém-solto: janela nova.
  const windowExpired = state ? nowMs - state.windowStartedAt.getTime() >= policy.windowMs : true
  const blockJustEnded = state?.blockedUntil != null
  if (!state || windowExpired || blockJustEnded) {
    const fresh: BucketState = { count: 1, windowStartedAt: now, blockedUntil: null }
    return { allowed: true, state: fresh, remaining: Math.max(0, policy.limit - 1) }
  }

  // 3. Dentro da janela, ainda cabe.
  if (state.count < policy.limit) {
    const next: BucketState = { ...state, count: state.count + 1 }
    return { allowed: true, state: next, remaining: policy.limit - next.count }
  }

  // 4. Estourou.
  if (blockMs > 0) {
    const blockedUntil = new Date(nowMs + blockMs)
    return { allowed: false, state: { ...state, blockedUntil }, retryAfterMs: blockMs }
  }
  const windowEndsMs = state.windowStartedAt.getTime() + policy.windowMs
  return { allowed: false, state, retryAfterMs: Math.max(1, windowEndsMs - nowMs) }
}
