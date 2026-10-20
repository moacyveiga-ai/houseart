// Núcleo PURO do cliente Prisma preguiçoso — sem Prisma, sem process.env.
// lib/prisma.ts passa a fábrica real; aqui só a mecânica de adiar, para ser
// testável (lib/prisma-lazy.test.ts).
//
// POR QUÊ (revisão adversarial da F0, 2026-09-06): o `next build` IMPORTA os
// módulos de rota em "Collecting page data", e 14 rotas de /api/cadastro fazem
// `crudCollection(prisma.cliente, …)` no escopo do módulo. Um singleton criado
// no carregamento do módulo (ou um Proxy que instancia no primeiro `get`)
// abre — ou recusa abrir — o banco no BUILD, que não tem DATABASE_URL. Por
// isso são DOIS níveis de adiamento:
//   · `prisma.cliente`           → devolve um delegate preguiçoso, sem
//                                  instanciar nada;
//   · `prisma.cliente.findMany`  → aí sim a fábrica roda (uma vez) e o método
//                                  vem ligado (bind) ao delegate real;
//   · `prisma.$transaction` etc. → métodos `$` resolvem o cliente na hora e
//                                  vêm ligados ao cliente real (dependem de
//                                  `this`).

type Fabrica<C extends object> = () => C

/** Delegate (prisma.<modelo>) que só resolve o alvo no primeiro acesso. */
function lazyDelegate(obterAlvo: () => object): object {
  return new Proxy(Object.create(null) as object, {
    get(_falso, prop) {
      const alvo = obterAlvo()
      const valor = Reflect.get(alvo, prop, alvo)
      return typeof valor === 'function' ? valor.bind(alvo) : valor
    },
    has(_falso, prop) {
      return Reflect.has(obterAlvo(), prop)
    },
  })
}

/**
 * Cria o cliente preguiçoso. `fabrica` roda no máximo uma vez, e só quando
 * uma consulta (ou um método `$…`) é de fato pedida.
 */
export function createLazyClient<C extends object>(fabrica: Fabrica<C>): C {
  let cliente: C | undefined
  const obterCliente = (): C => {
    if (cliente === undefined) cliente = fabrica()
    return cliente
  }

  // Um delegate por nome de modelo, para `prisma.cliente === prisma.cliente`
  // e para não criar um Proxy novo a cada acesso.
  const delegates = new Map<string, object>()

  return new Proxy(Object.create(null) as C, {
    get(_falso, prop) {
      if (typeof prop === 'string' && !prop.startsWith('$')) {
        let d = delegates.get(prop)
        if (d === undefined) {
          d = lazyDelegate(() => {
            const alvo = obterCliente()
            const valor = Reflect.get(alvo, prop, alvo)
            if (valor === null || (typeof valor !== 'object' && typeof valor !== 'function')) {
              throw new TypeError(`prisma.${prop} não é um delegate do Prisma`)
            }
            return valor as object
          })
          delegates.set(prop, d)
        }
        return d
      }
      const alvo = obterCliente()
      const valor = Reflect.get(alvo, prop, alvo)
      return typeof valor === 'function' ? valor.bind(alvo) : valor
    },
    has(_falso, prop) {
      return Reflect.has(obterCliente(), prop)
    },
  })
}
