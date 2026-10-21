import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// O mesmo `@/*` → `./*` do tsconfig.json: os testes de integração importam
// `@/lib/prisma` como o app (o Vitest não lê `paths` do tsconfig sozinho).
const RAIZ = fileURLToPath(new URL('.', import.meta.url))

// Worktrees do Claude Code vivem em .claude/worktrees/ e são cópias do
// repo inteiro — sem este exclude, cada teste deles é coletado de novo
// no `vitest run` do repo principal.
const exclude = [...configDefaults.exclude, '**/.claude/**']

// Globs cobrindo .ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs e os sufixos .test e
// .spec — o `**/*.test.ts` antigo deixaria de fora um teste .tsx ou .mts sem
// ninguém perceber (revisão 2026-09-06).
const GLOB_INTEGRACAO = '**/*.integration.test.?(c|m)[jt]s?(x)'
const GLOB_TODOS = '**/*.{test,spec}.?(c|m)[jt]s?(x)'

export default defineConfig({
  // O alias '@/' do tsconfig — sem ele, teste que importa um route handler ou
  // qualquer módulo por caminho absoluto não resolve.
  //
  // `server-only` também: o `index.js` do pacote LANÇA quando não está numa
  // árvore React Server, então qualquer `lib/**/*-server.ts` que use o
  // marcador ficaria intestável (o erro é "cannot be imported from a Client
  // Component"). O pacote já traz o no-op que o próprio React usa na condição
  // `react-server`; apontar o teste para ele não afrouxa nada em build — o
  // Next continua barrando a importação de verdade.
  resolve: {
    alias: {
      '@': RAIZ,
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    exclude,
    // Dois projects (Vitest 4): `unit` = tudo que não é *.integration.test.*;
    // `integration` = só *.integration.test.*, contra o Postgres REAL de
    // DATABASE_URL_TEST (globalSetup em test/integration/setup.ts aplica as
    // migrations e aponta DATABASE_URL para ele; os workers do pool `forks`
    // herdam esse process.env — não há setupFiles repetindo a checagem;
    // sem paralelismo de arquivos porque os testes TRUNCAM tabelas do mesmo
    // banco). Nenhum dos dois aceita zero arquivos:
    // um glob quebrado tem que ficar vermelho. `vitest run` sem --project
    // continua rodando os dois.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [GLOB_TODOS],
          exclude: [...exclude, GLOB_INTEGRACAO],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [GLOB_INTEGRACAO],
          exclude,
          globalSetup: ['./test/integration/setup.ts'],
          // Espera o trabalho solto do teste antes do próximo (Lote 7e).
          setupFiles: ['./test/integration/next-headers-mock.ts', './test/integration/after-detached.ts'],
          pool: 'forks',
          fileParallelism: false,
          // O primeiro teste de cada describe faz o `await import(...route)`
          // FRIO, que sob carga da máquina passa dos 5 s padrão (calma, nenhum
          // teste do arquivo passa de 1 s) — teto folgado para o import, não
          // para esconder defeito (auditoria, Lote 6; reconferência C §4).
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
