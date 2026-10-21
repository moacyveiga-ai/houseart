// Borda HTTP do rate limit: a resposta 429 com `Retry-After`. Uma só, para
// toda rota que usa o store — o texto é o MESMO em qualquer dimensão (IP ou
// conta), de propósito: a resposta não pode dizer se a conta existe.
import { NextResponse } from 'next/server'
import { retryAfterSeconds, type RateLimitDecision } from './rate-limit-core'

export const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde um pouco e tente de novo.'

/**
 * A mesma frase com o tempo de espera ("tente de novo em 15 min"), em minutos
 * arredondados para CIMA — nunca promete antes do `Retry-After`. Não abre
 * oráculo novo: o tempo já sai no cabeçalho.
 */
export function rateLimitMessage(retryAfterMs: number): string {
  const min = Math.max(1, Math.ceil(retryAfterSeconds(retryAfterMs) / 60))
  return `Muitas tentativas. Tente de novo em ${min} min.`
}

/** 429 + `Retry-After` (segundos). `body` extra entra no JSON (ex.: `{ ok: false }` do login). */
export function rateLimitResponse(
  decision: Extract<RateLimitDecision, { allowed: false }>,
  body: Record<string, unknown> = { erro: RATE_LIMIT_MESSAGE },
): NextResponse {
  return NextResponse.json(body, {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds(decision.retryAfterMs)) },
  })
}
