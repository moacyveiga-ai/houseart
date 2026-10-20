// Auditoria 2026-10-11 (A-TEN-15): o núcleo puro da trava de rodada de job.
import { describe, expect, it } from 'vitest'
import { JOB_LEASE_DEFAULT_MS, leaseMs, skippedBody } from './core'

describe('leaseMs', () => {
  it('sem valor → o padrão de 300 s (o maior maxDuration das rotas de job)', () => {
    expect(JOB_LEASE_DEFAULT_MS).toBe(300_000)
    expect(leaseMs(undefined)).toBe(300_000)
  })

  it('inteiro positivo até 900 s vale como veio', () => {
    expect(leaseMs(60_000)).toBe(60_000)
    expect(leaseMs(900_000)).toBe(900_000)
  })

  it('negativo, zero, fracionário, não finito ou acima de 900 s → o padrão', () => {
    expect(leaseMs(-1)).toBe(300_000)
    expect(leaseMs(0)).toBe(300_000)
    expect(leaseMs(1.5)).toBe(300_000)
    expect(leaseMs(Number.NaN)).toBe(300_000)
    expect(leaseMs(Number.POSITIVE_INFINITY)).toBe(300_000)
    expect(leaseMs(1e9)).toBe(300_000)
  })
})

describe('skippedBody', () => {
  it('rodada que acha a trava ocupada: 200 com ok e o motivo, nunca erro', () => {
    expect(skippedBody('x')).toEqual({ ok: true, job: 'x', skipped: 'running' })
  })
})
