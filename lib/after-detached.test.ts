// O trabalho que fora de request roda SOLTO (script, cron à mão, teste) fica
// registrado para quem precisa esperar por ele: o afterEach global dos testes
// de integração (test/integration/esperar-solto.ts) espera esse trabalho
// terminar antes do TRUNCATE do próximo teste. Sem isso, uma escrita solta do
// teste anterior cruzava com o TRUNCATE (deadlock 40P01) ou tocava a linha de
// mesmo id que o teste seguinte acabou de criar (RESTART IDENTITY).
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({ after: () => { throw new Error('fora de request') } }))

import { afterResponse, awaitDetached, detachedSafe, detach, detachedPending } from './after'
import { read, sourceFiles } from './architecture/source-graph'

const adiado = () => {
  let terminar!: () => void
  const p = new Promise<void>((r) => { terminar = r })
  return { p, terminar }
}

describe('trabalho solto fora de request', () => {
  it('detach registra a promessa até ela terminar, com o rótulo', async () => {
    const { p, terminar } = adiado()
    detach('aviso x', p)
    expect(detachedPending()).toEqual(['aviso x'])
    terminar()
    await awaitDetached()
    expect(detachedPending()).toEqual([])
  })

  it('awaitDetached espera também o trabalho que nasce de outro trabalho solto', async () => {
    const feito: string[] = []
    detach('pai', (async () => {
      await new Promise((r) => setTimeout(r, 5))
      detach('filho', (async () => { await new Promise((r) => setTimeout(r, 5)); feito.push('filho') })())
      feito.push('pai')
    })())
    await awaitDetached()
    expect(feito).toEqual(['pai', 'filho'])
  })

  it('promessa rejeitada sai do registro e não derruba a espera', async () => {
    detach('falha', Promise.reject(new Error('x')))
    await expect(awaitDetached()).resolves.toBeUndefined()
    expect(detachedPending()).toEqual([])
  })

  it('afterResponse fora de request entra no registro', async () => {
    const { p, terminar } = adiado()
    afterResponse('e-mail', () => p)
    expect(detachedPending()).toEqual(['e-mail'])
    terminar()
    await awaitDetached()
    expect(detachedPending()).toEqual([])
  })

  it('detachedSafe fora de request entra no registro e devolve a mesma promessa', async () => {
    const { p, terminar } = adiado()
    const devolvida = detachedSafe(p)
    expect(devolvida).toBe(p)
    expect(detachedPending()).toEqual(['detachedSafe'])
    terminar()
    await awaitDetached()
    expect(detachedPending()).toEqual([])
  })
})

describe('detach só no ramo catch do after()', () => {
  // Em request o trabalho solto morre quando a função congela: `detach` é o
  // fallback de fora de request, nunca o caminho principal.
  const QUEM_SOLTA = ['lib/after.ts']
  it('ninguém mais chama detach', () => {
    const chamam = sourceFiles('app', 'lib', 'components')
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /\bdetach\(/.test(read(f)))
    expect(chamam.sort()).toEqual([...QUEM_SOLTA].sort())
  }, 30_000)
})
