// Utilidades de banco para os testes de integração (Postgres real, banco de
// DATABASE_URL_TEST — o globalSetup garante que DATABASE_URL aponta para ele).
import { prisma } from '@/lib/prisma'

const NOME_TABELA = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Esvazia as tabelas nomeadas (nomes do Prisma, ex.: 'Usuario') e zera as
 * sequências. CASCADE leva junto o que referencia essas tabelas por FK —
 * liste as tabelas-raiz do cenário e o resto cai por arrasto.
 * Uso típico: `beforeEach(() => limparTabelas(['Usuario', 'Corretor']))`.
 */
export async function limparTabelas(nomes: string[]): Promise<void> {
  if (nomes.length === 0) return
  for (const n of nomes) {
    if (!NOME_TABELA.test(n)) throw new Error(`nome de tabela inválido para TRUNCATE: "${n}"`)
  }
  const lista = nomes.map((n) => `"${n}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`)
}
