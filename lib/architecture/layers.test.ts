// Catraca de CAMADAS (QA geral, seção 6 — "teste de fronteira genérico por
// camadas"). Três regras, para o repositório inteiro:
//
//  1. núcleo puro (`lib/**/*-core.ts`, `lib/**/core.ts`) não importa servidor:
//     nem `@/lib/prisma`, nem `server-only`, nem `next/*`, nem arquivo
//     `*-server.ts`/`server.ts` — é o que deixa a regra testável sem banco;
//  2. arquivo `'use client'` não importa servidor — senão o segredo e o
//     cliente do Prisma vão para o bundle do navegador sem erro de build
//     (o relatório achou `server-only` importado em 0 arquivos);
//  3. lib/ não importa de app/ nem de components/ (a regra desce, a tela
//     sobe) — o client gerado do Prisma em app/generated é a exceção.
//
// As exceções de hoje estão listadas com o porquê e SÓ DIMINUEM: exceção que
// deixou de violar quebra o teste até sair da lista.
import { describe, expect, it } from 'vitest'
import { importsOf, read, resolveImport, runtimeImports, sourceFiles } from './source-graph'

const isServerTarget = (spec: string, target: string | null): boolean =>
  spec === 'server-only' ||
  spec.startsWith('next/') ||
  target === 'lib/prisma.ts' ||
  (target != null && /(^|\/|-)server\.tsx?$/.test(target))

function violations(files: string[], rule: (file: string, spec: string, target: string | null) => boolean): string[] {
  const out: string[] = []
  for (const f of files) {
    for (const spec of importsOf(f)) {
      const target = resolveImport(f, spec)
      if (rule(f, spec, target)) out.push(`${f} -> ${target ?? spec}`)
    }
  }
  return [...new Set(out)].sort()
}

/** lib/ → components/: rótulos de proposta que nasceram na tela. Mover para lib/ofertas é a saída. */
const LIB_IMPORTA_TELA: string[] = []

describe('catraca de camadas', () => {
  const lib = sourceFiles('lib')
  const todos = sourceFiles('lib', 'app', 'components')

  it('núcleo puro (*-core.ts, core.ts) não importa servidor, Prisma nem Next', () => {
    const nucleos = lib.filter((f) => /(-core|\/core)\.ts$/.test(f))
    expect(nucleos.length).toBeGreaterThan(0) // a varredura acha os núcleos
    expect(violations(nucleos, (_f, spec, target) => isServerTarget(spec, target))).toEqual([])
  })

  it("arquivo 'use client' não importa servidor nem Prisma", () => {
    const clientes = todos.filter((f) => /^\s*['"]use client['"]/m.test(read(f).slice(0, 400)))
    expect(clientes.length).toBeGreaterThan(0)
    const SO_SERVIDOR = new Set(['server-only', 'next/headers', 'next/server', 'next/cache'])
    expect(violations(clientes, (_f, spec, target) => SO_SERVIDOR.has(spec) || (!spec.startsWith('next/') && isServerTarget(spec, target)))).toEqual([])
  })

  it('lib/ não importa de app/ (fora o client gerado do Prisma) nem de components/', () => {
    const achadas = violations(lib, (_f, _spec, target) =>
      target != null && ((target.startsWith('app/') && !target.startsWith('app/generated/')) || target.startsWith('components/')))
    expect(achadas).toEqual(LIB_IMPORTA_TELA)
  })

  it('o leitor de imports enxerga o que diz (import type não conta; dinâmico conta)', () => {
    expect(runtimeImports(`import type { A } from './a'\nimport { type B, type C } from './b'\nexport type { D } from './d'`)).toEqual([])
    expect(runtimeImports(`import { x } from './x'\nimport './y'\nconst z = await import('./z')\nexport { w } from './w'`).sort()).toEqual(['./w', './x', './y', './z'])
    expect(runtimeImports(`// import { x } from './x'`)).toEqual([])
    // revisão de 2026-10-03: o import depois de um `export type` sem ponto e vírgula não some
    expect(runtimeImports(`export type P = {\n  id: number\n}\nimport { prisma } from '@/lib/prisma'`)).toEqual(['@/lib/prisma'])
    // `typeof import('x')` é tipo, não carrega nada
    expect(runtimeImports(`type M = typeof import('./m')\nlet t: import('./t').T`)).toEqual([])
    expect(runtimeImports(`import x, { type Y } from './x'\nexport * from './all'`).sort()).toEqual(['./all', './x'])
  })
})
