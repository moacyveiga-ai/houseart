import { describe, it, expect } from 'vitest'
import {
  decidirBaseline,
  decidirConexaoMigracao,
  diagnosticoDeTravas,
  diagnosticoMigrationsFalhadas,
  resolveFoiIdempotente,
  urlComLockTimeout,
  CODIGO_RESOLVE_IDEMPOTENTE,
  LOCK_TIMEOUT_PADRAO_MS,
  SQL_MIGRATIONS_FALHADAS,
  SQL_TRAVAS,
  TABELA_DA_BASELINE,
} from './migrate-deploy-core.mjs'

const NEON_POOLER =
  'postgresql://u:p@ep-dry-rice-91135294-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require'
const NEON_DIRETA =
  'postgresql://u:p@ep-dry-rice-91135294.sa-east-1.aws.neon.tech/neondb?sslmode=require'

describe('decidirConexaoMigracao', () => {
  it('DIRECT_URL presente → usa a direta com o lock LIGADO', () => {
    expect(decidirConexaoMigracao({ databaseUrl: NEON_POOLER, directUrl: NEON_DIRETA })).toEqual({
      url: NEON_DIRETA,
      desligarLock: false,
      origem: 'DIRECT_URL',
    })
  })

  it('DIRECT_URL vazia (ou só espaços) conta como ausente', () => {
    expect(decidirConexaoMigracao({ databaseUrl: NEON_POOLER, directUrl: '  ' })).toEqual({
      url: NEON_POOLER,
      desligarLock: true,
      origem: 'DATABASE_URL',
    })
  })

  it('só DATABASE_URL → lock DESLIGADO, seja qual for a URL (sem heurística de pooler)', () => {
    // Revisão 2026-09-06: a regex de pooler saiu; sem DIRECT_URL o
    // comportamento é o que a Vercel sempre teve (lock desligado).
    for (const url of [NEON_POOLER, NEON_DIRETA, 'postgresql://u:p@host/db?pgbouncer=true']) {
      expect(decidirConexaoMigracao({ databaseUrl: url })).toEqual({
        url,
        desligarLock: true,
        origem: 'DATABASE_URL',
      })
    }
  })

  it('PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 explícito desliga o lock mesmo com DIRECT_URL', () => {
    expect(
      decidirConexaoMigracao({ databaseUrl: NEON_POOLER, directUrl: NEON_DIRETA, disableLockEnv: '1' }),
    ).toEqual({ url: NEON_DIRETA, desligarLock: true, origem: 'DIRECT_URL' })
  })

  it('override com valor diferente de "1" não desliga o lock', () => {
    for (const valor of ['0', '', 'true', undefined]) {
      expect(
        decidirConexaoMigracao({ directUrl: NEON_DIRETA, disableLockEnv: valor }).desligarLock,
      ).toBe(false)
    }
  })

  it('sem URL nenhuma → erro', () => {
    expect(() => decidirConexaoMigracao({})).toThrow(/DATABASE_URL/)
    expect(() => decidirConexaoMigracao({ databaseUrl: ' ', directUrl: '' })).toThrow(/DATABASE_URL/)
    // A mensagem é lida no log da Vercel por quem está com o deploy vermelho:
    // tem de dizer o que configurar e ONDE. "nada a migrar" soava benigno e
    // escondia que o build ia morrer (deploy de 2026-09-23).
    expect(() => decidirConexaoMigracao({})).toThrow(/DIRECT_URL/)
    expect(() => decidirConexaoMigracao({})).toThrow(/DATABASE_URL e DIRECT_URL ausentes/)
    expect(() => decidirConexaoMigracao({})).not.toThrow(/nada a migrar/)
  })

  it('URLs são normalizadas (trim)', () => {
    expect(decidirConexaoMigracao({ databaseUrl: `  ${NEON_POOLER} ` }).url).toBe(NEON_POOLER)
  })
})

describe('resolveFoiIdempotente', () => {
  it('reconhece a P3008 do Prisma pelo código (baseline já registrada)', () => {
    const saida =
      'Error: P3008\n\nThe migration `20260701193536_baseline` is already recorded as applied in the database.\n'
    expect(resolveFoiIdempotente(saida)).toBe(true)
    expect(CODIGO_RESOLVE_IDEMPOTENTE).toBe('P3008')
  })

  it('a frase sozinha, sem o código, não basta (comparação é pelo código)', () => {
    expect(resolveFoiIdempotente('is already recorded as applied')).toBe(false)
  })

  it('qualquer outra falha é erro real', () => {
    expect(resolveFoiIdempotente("Error: P1001: Can't reach database server")).toBe(false)
    expect(resolveFoiIdempotente('Error: P3009 failed migrations found')).toBe(false)
    expect(resolveFoiIdempotente('')).toBe(false)
  })
})

describe('decidirBaseline', () => {
  it('banco herdado (a tabela da baseline existe) → marca como aplicada, como sempre', () => {
    expect(decidirBaseline({ tabelaExiste: true }).acao).toBe('resolver')
  })

  it('banco NOVO (tabela não existe) → deixa o deploy aplicar a baseline de verdade', () => {
    // O bug de 2026-09-15 (primeiro deploy no Supabase da Viby): marcar a
    // baseline como aplicada num banco vazio pulava as 57 tabelas dela, e a
    // migration seguinte morria com 42P01 relation "MarketplaceListing"
    // does not exist — deixando a linha FALHOU na _prisma_migrations.
    expect(decidirBaseline({ tabelaExiste: false }).acao).toBe('aplicar')
  })

  it('o motivo nomeia a tabela consultada — o log do build precisa ser legível', () => {
    for (const tabelaExiste of [true, false]) {
      expect(decidirBaseline({ tabelaExiste }).motivo).toContain(TABELA_DA_BASELINE)
    }
  })
})

// O deploy de 24/09/2026 ficou 46 min preso e morreu no teto de build da
// Vercel, sem uma linha de log útil. Estas duas perguntas passam a ser feitas
// ANTES de migrar — são a diferença entre "falhou" e "falhou por isto".
describe('diagnosticoMigrationsFalhadas', () => {
  it('banco limpo não trava nada', () => {
    const d = diagnosticoMigrationsFalhadas([])
    expect(d.travado).toBe(false)
    expect(d.mensagem).toContain('nenhuma migration em falha')
  })

  it('migration começada e não terminada TRAVA o deploy, e a mensagem nomeia as duas saídas', () => {
    const d = diagnosticoMigrationsFalhadas([
      { migration_name: '20260924180000_repasse_servicos', started_at: '2026-09-24T12:00:00.000Z' },
    ])
    expect(d.travado).toBe(true)
    expect(d.mensagem).toContain('20260924180000_repasse_servicos')
    expect(d.mensagem).toContain('P3009')
    // as DUAS opções, porque só quem lê o SQL sabe qual vale
    expect(d.mensagem).toContain('--rolled-back 20260924180000_repasse_servicos')
    expect(d.mensagem).toContain('--applied 20260924180000_repasse_servicos')
    expect(d.mensagem).toContain('2026-09-24T12:00:00.000Z')
  })

  it('sem started_at a linha ainda aparece — o nome é o que importa', () => {
    const d = diagnosticoMigrationsFalhadas([{ migration_name: '20260101000000_x', started_at: null }])
    expect(d.travado).toBe(true)
    expect(d.mensagem).toContain('início desconhecido')
  })

  it('a consulta procura o estado certo: começou, não terminou, não foi revertida', () => {
    expect(SQL_MIGRATIONS_FALHADAS).toContain('finished_at IS NULL')
    expect(SQL_MIGRATIONS_FALHADAS).toContain('rolled_back_at IS NULL')
  })
})

describe('diagnosticoDeTravas', () => {
  it('ninguém segurando nada', () => {
    expect(diagnosticoDeTravas([])).toEqual({
      suspeito: false,
      mensagem: 'sem advisory lock preso nem transação aberta — caminho livre',
    })
  })

  it('advisory lock preso é o suspeito — é ele que faz o migrate esperar para sempre', () => {
    const d = diagnosticoDeTravas([
      { pid: 4242, state: 'idle in transaction', wait_event_type: 'Client', application_name: 'prisma-migrate', segundos_em_transacao: 2760, tem_advisory: true },
    ])
    expect(d.suspeito).toBe(true)
    expect(d.mensagem).toContain('4242')
    expect(d.mensagem).toContain('SEGURANDO advisory lock')
    expect(d.mensagem).toContain('2760s')
  })

  it('transação longa SEM advisory lock é reportada, mas não é o suspeito', () => {
    const d = diagnosticoDeTravas([
      { pid: 7, state: 'active', wait_event_type: null, application_name: null, segundos_em_transacao: 120, tem_advisory: false },
    ])
    expect(d.suspeito).toBe(false)
    expect(d.mensagem).toContain('pid 7')
    expect(d.mensagem).toContain('sem nome')
  })

  // PII: `pg_stat_activity.query` carrega o texto da consulta, que numa app
  // de imóveis tem CPF e endereço. O log do build é lido por gente e guardado
  // pela Vercel — a coluna não entra.
  it('a consulta NÃO lê o texto da query', () => {
    expect(SQL_TRAVAS).not.toMatch(/\ba\.query\b/)
    expect(SQL_TRAVAS).toContain('pg_backend_pid()')
    expect(SQL_TRAVAS).toContain('current_database()')
  })
})

describe('urlComLockTimeout', () => {
  it('acrescenta o teto de espera preservando os parâmetros que já existem', () => {
    const r = urlComLockTimeout(NEON_DIRETA)
    expect(r.aplicado).toBe(true)
    expect(r.url).toContain('sslmode=require')
    expect(r.url).toContain(`options=-c%20lock_timeout%3D${LOCK_TIMEOUT_PADRAO_MS}`)
  })

  it('o espaço vai como %20, nunca como "+"', () => {
    // O parser de URL do Prisma é Rust e só faz percent-decoding: com `+` o
    // servidor receberia `-c+lock_timeout=15000` e recusaria a conexão.
    // Provado contra o Postgres local: `SHOW lock_timeout` devolve o valor.
    expect(urlComLockTimeout(NEON_DIRETA).url).not.toContain('+')
  })

  it('URL sem query nenhuma ganha o `?`', () => {
    expect(urlComLockTimeout('postgresql://u:p@h:5432/db').url)
      .toBe(`postgresql://u:p@h:5432/db?options=-c%20lock_timeout%3D${LOCK_TIMEOUT_PADRAO_MS}`)
  })

  it('`options` já configurada é respeitada — duas `-c` no lugar errado quebram a conexão', () => {
    const url = 'postgresql://u:p@h/db?options=-c%20search_path%3Dmyschema'
    expect(urlComLockTimeout(url)).toEqual({
      url,
      aplicado: false,
      motivo: 'a URL já traz `options` — respeitando o que está configurado',
    })
  })

  it('URL impossível volta intacta: diagnóstico não derruba deploy', () => {
    expect(urlComLockTimeout('isto-nao-e-url').url).toBe('isto-nao-e-url')
    expect(urlComLockTimeout('isto-nao-e-url').aplicado).toBe(false)
  })

  it('valor inválido cai no padrão, e o padrão é espera, não trabalho', () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(urlComLockTimeout(NEON_DIRETA, v).url).toContain(`lock_timeout%3D${LOCK_TIMEOUT_PADRAO_MS}`)
    }
    expect(urlComLockTimeout(NEON_DIRETA, 3000).url).toContain('lock_timeout%3D3000')
    // 15 s é teto de ESPERA por lock; nunca é teto de trabalho (statement_timeout)
    expect(urlComLockTimeout(NEON_DIRETA).url).not.toContain('statement_timeout')
  })
})

