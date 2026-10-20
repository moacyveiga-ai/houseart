// Catraca do Prisma DIRETO em app/ — rota, página, layout e os ajudantes ao
// lado deles, como `_guarda.ts` (QA geral, seções 4.7 e 6): "nada de regra
// de negócio em route.ts" (CLAUDE.md, regra 4), mas em 2026-10-02 eram 128 rotas e 65 páginas/layouts consultando o banco sem
// passar por lib/<modulo>, além de três `_guarda.ts` (a revisão de
// 2026-10-03 achou o atalho: a consulta num `_q.ts` ao lado da rota). Todas
// herdadas; módulo novo delega.
//
// A lista de `baseline/prisma-in-routes.json` só diminui: arquivo NOVO que
// importa `@/lib/prisma` quebra o teste (a consulta vai para lib/), e arquivo
// da lista que parou de importar também (tire-o da lista).
import { describe, expect, it } from 'vitest'
import baseline from './baseline/prisma-in-routes.json'
import { importsOf, read, resolveImport, sourceFiles } from './source-graph'

/**
 * As portas do cliente do Prisma: o próprio `lib/prisma.ts` e quem o
 * REEXPORTA (`export { prisma }`) — senão a rota importaria por ali e passaria.
 */
const PORTAS = new Set(['lib/prisma.ts', ...sourceFiles('lib').filter((f) => /\bexport\s*\{[^}]*\bprisma\b[^}]*\}/.test(read(f)))])

describe('catraca do Prisma direto em app/', () => {
  const comPrisma = sourceFiles('app').filter((f) => importsOf(f).some((s) => PORTAS.has(resolveImport(f, s) ?? '')))

  const base = new Set<string>(baseline)

  it('nenhum arquivo NOVO de app/ importa o Prisma', () => {
    expect(comPrisma.filter((f) => !base.has(f))).toEqual([])
  })

  it('a lista só diminui: quem deixou de importar sai dela', () => {
    const atual = new Set(comPrisma)
    expect(baseline.filter((f) => !atual.has(f))).toEqual([])
  })
})
