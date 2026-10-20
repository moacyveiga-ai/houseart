import { describe, it, expect, vi } from 'vitest'
import { createLazyClient } from './prisma-lazy'

// Cliente falso com a forma que importa: delegates por modelo (métodos que
// dependem de `this`) e métodos `$…` no próprio cliente.
class ClienteFalso {
  readonly nome = 'real'
  readonly cliente = {
    dono: 'delegate',
    findMany(this: { dono: string }, args: unknown) {
      return { via: this.dono, args }
    },
  }
  $transaction(this: ClienteFalso, fn: (c: ClienteFalso) => unknown) {
    return { via: this.nome, resultado: fn(this) }
  }
}

function montar() {
  const fabrica = vi.fn(() => new ClienteFalso())
  const prisma = createLazyClient<ClienteFalso>(fabrica)
  return { fabrica, prisma }
}

describe('createLazyClient', () => {
  it('criar o cliente não roda a fábrica', () => {
    const { fabrica } = montar()
    expect(fabrica).not.toHaveBeenCalled()
  })

  it('acessar prisma.<modelo> (o que as rotas de cadastro fazem no escopo do módulo) não roda a fábrica', () => {
    // Revisão 2026-09-06: é exatamente isto que quebrava o `next build` sem
    // DATABASE_URL — `crudCollection(prisma.cliente, …)` na importação.
    const { fabrica, prisma } = montar()
    const delegate = prisma.cliente
    expect(delegate).toBeDefined()
    expect(fabrica).not.toHaveBeenCalled()
  })

  it('a fábrica roda uma única vez, na primeira consulta, e o método vem ligado ao delegate real', () => {
    const { fabrica, prisma } = montar()
    const r1 = prisma.cliente.findMany({ a: 1 })
    const r2 = prisma.cliente.findMany({ a: 2 })
    expect(r1).toEqual({ via: 'delegate', args: { a: 1 } })
    expect(r2).toEqual({ via: 'delegate', args: { a: 2 } })
    expect(fabrica).toHaveBeenCalledTimes(1)
  })

  it('o mesmo delegate é devolvido a cada acesso', () => {
    const { prisma } = montar()
    expect(prisma.cliente).toBe(prisma.cliente)
  })

  it('métodos $… vêm ligados ao cliente real (dependem de `this`)', () => {
    const { fabrica, prisma } = montar()
    const r = prisma.$transaction((c) => c.nome)
    expect(r).toEqual({ via: 'real', resultado: 'real' })
    expect(fabrica).toHaveBeenCalledTimes(1)
  })

  it('a falha da fábrica (ex.: DATABASE_URL inválida) só aparece na primeira consulta', () => {
    const fabrica = vi.fn(() => {
      throw new Error('DATABASE_URL inválida')
    })
    const prisma = createLazyClient<ClienteFalso>(fabrica)
    const delegate = prisma.cliente // ainda não falha
    expect(fabrica).not.toHaveBeenCalled()
    expect(() => delegate.findMany({})).toThrow('DATABASE_URL inválida')
  })

  it('propriedade que não é delegate no cliente real é erro claro ao usar', () => {
    const { prisma } = montar()
    const errado = (prisma as unknown as Record<string, { x: unknown }>).naoExiste
    expect(() => errado.x).toThrow(/não é um delegate/)
  })

  it('`in` consulta o cliente real', () => {
    const { fabrica, prisma } = montar()
    expect('cliente' in prisma).toBe(true)
    expect('inexistente' in prisma).toBe(false)
    expect(fabrica).toHaveBeenCalledTimes(1)
  })
})
