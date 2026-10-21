// Núcleo puro do rate limit: janela fixa, limite, bloqueio e "zera no
// sucesso" (que no store é apagar o balde — aqui, estado null).
import { describe, expect, it } from 'vitest'
import { decide, retryAfterSeconds, type BucketState, type RateLimitPolicy } from './rate-limit-core'

const T0 = new Date('2026-09-21T12:00:00.000Z')
const em = (ms: number) => new Date(T0.getTime() + ms)
const MIN = 60_000

/** Aplica `n` tentativas em sequência a partir de `state`, devolvendo as decisões. */
function tentativas(state: BucketState | null, policy: RateLimitPolicy, instantes: Date[]) {
  const decisoes = []
  let atual = state
  for (const t of instantes) {
    const d = decide(atual, policy, t)
    decisoes.push(d)
    atual = d.state
  }
  return decisoes
}

describe('rate-limit-core · janela fixa e limite', () => {
  const policy: RateLimitPolicy = { limit: 3, windowMs: 10 * MIN }

  it('balde inédito abre a janela com count 1 e remaining limit-1', () => {
    const d = decide(null, policy, T0)
    expect(d).toEqual({ allowed: true, state: { count: 1, windowStartedAt: T0, blockedUntil: null }, remaining: 2 })
  })

  it('exatamente `limit` passam; a seguinte é recusada até o fim da janela', () => {
    const ds = tentativas(null, policy, [T0, em(1000), em(2000), em(3000)])
    expect(ds.map((d) => d.allowed)).toEqual([true, true, true, false])
    const recusada = ds[3]
    if (recusada.allowed) throw new Error('esperava recusa')
    expect(recusada.retryAfterMs).toBe(10 * MIN - 3000)
    // Sem blockMs o estado não muda na recusa (count fica em limit, sem bloqueio).
    expect(recusada.state).toEqual(ds[2].state)
  })

  it('janela vencida → janela nova (count volta a 1)', () => {
    const cheio: BucketState = { count: 3, windowStartedAt: T0, blockedUntil: null }
    const d = decide(cheio, policy, em(10 * MIN))
    expect(d.allowed).toBe(true)
    expect(d.state).toEqual({ count: 1, windowStartedAt: em(10 * MIN), blockedUntil: null })
  })

  it('a janela é fixa: a tentativa no último milissegundo ainda conta na mesma', () => {
    const cheio: BucketState = { count: 3, windowStartedAt: T0, blockedUntil: null }
    expect(decide(cheio, policy, em(10 * MIN - 1)).allowed).toBe(false)
  })
})

describe('rate-limit-core · bloqueio', () => {
  const policy: RateLimitPolicy = { limit: 2, windowMs: 15 * MIN, blockMs: 15 * MIN }

  it('estourar com blockMs grava blockedUntil = agora + blockMs e responde retryAfter = blockMs', () => {
    const ds = tentativas(null, policy, [T0, em(1000), em(2000)])
    const d = ds[2]
    if (d.allowed) throw new Error('esperava recusa')
    expect(d.retryAfterMs).toBe(15 * MIN)
    expect(d.state.blockedUntil).toEqual(em(2000 + 15 * MIN))
    expect(d.state.count).toBe(2)
  })

  it('bloqueado: tentativas NÃO contam nem prorrogam o bloqueio (sem DoS por credencial)', () => {
    const bloqueado: BucketState = { count: 2, windowStartedAt: T0, blockedUntil: em(15 * MIN) }
    const d1 = decide(bloqueado, policy, em(5 * MIN))
    if (d1.allowed) throw new Error('esperava recusa')
    expect(d1.state).toBe(bloqueado)
    expect(d1.retryAfterMs).toBe(10 * MIN)
    const d2 = decide(d1.state, policy, em(14 * MIN + 59_000))
    if (d2.allowed) throw new Error('esperava recusa')
    expect(d2.state.blockedUntil).toEqual(em(15 * MIN))
  })

  it('bloqueio solto → janela nova, mesmo que a janela antiga ainda não tenha vencido', () => {
    // windowMs 15 min, bloqueio de 1 min: solta antes de a janela vencer.
    const curto: RateLimitPolicy = { limit: 2, windowMs: 15 * MIN, blockMs: MIN }
    const bloqueado: BucketState = { count: 2, windowStartedAt: T0, blockedUntil: em(MIN) }
    const d = decide(bloqueado, curto, em(MIN))
    expect(d.allowed).toBe(true)
    expect(d.state).toEqual({ count: 1, windowStartedAt: em(MIN), blockedUntil: null })
  })

  it('zera no sucesso: apagar o balde (estado null) devolve o limite inteiro', () => {
    const cheio: BucketState = { count: 2, windowStartedAt: T0, blockedUntil: em(15 * MIN) }
    expect(decide(cheio, policy, em(1000)).allowed).toBe(false)
    const d = decide(null, policy, em(1000))
    expect(d.allowed).toBe(true)
    if (d.allowed) expect(d.remaining).toBe(1)
  })
})

describe('rate-limit-core · retryAfterSeconds', () => {
  it('arredonda para cima e nunca devolve 0', () => {
    expect(retryAfterSeconds(1)).toBe(1)
    expect(retryAfterSeconds(0)).toBe(1)
    expect(retryAfterSeconds(1500)).toBe(2)
    expect(retryAfterSeconds(15 * MIN)).toBe(900)
  })
})
