// Deploy das migrations do Postgres (Neon) no build da Vercel — I/O do
// núcleo puro em scripts/migrate-deploy-core.mjs.
//
// Substitui a linha antiga do package.json, que tinha dois problemas:
//   1. `|| true` no `migrate resolve` engolia QUALQUER erro (a intenção era só
//      tolerar "baseline já registrada", P3008);
//   2. `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` era fixo — com `DIRECT_URL`
//      (conexão direta) o lock deve ficar LIGADO. Sem `DIRECT_URL` ele
//      continua desligado, como sempre esteve (revisão 2026-09-06).
//
// Quem chama: `migrate:pg:deploy:ci` (package.json), que só invoca este
// script com `VERCEL_ENV=production` — desde 2026-09-23 o projeto tem UM
// ambiente só (o `uat` customizado foi aposentado; as variáveis dele passaram
// a valer em Production). Um build de preview comum NÃO pode aplicar DDL em
// banco nenhum (revisão 2026-09-06: `$VERCEL` é `1` em todo build, inclusive
// previews, e era esse o gatilho antigo). A mesma condição está no
// `ignoreCommand` do vercel.json — preview nem chega a buildar.
//
// Uso: `node scripts/migrate-deploy.mjs` (script `migrate:pg:vercel`).
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import {
  decidirBaseline,
  decidirConexaoMigracao,
  diagnosticoDeTravas,
  diagnosticoMigrationsFalhadas,
  resolveFoiIdempotente,
  urlComLockTimeout,
  LOCK_TIMEOUT_PADRAO_MS,
  SQL_MIGRATIONS_FALHADAS,
  SQL_TRAVAS,
  TABELA_DA_BASELINE,
} from './migrate-deploy-core.mjs'

const BASELINE = '20261020000000_baseline'
// Os TRÊS passos usam o config padrão (prisma.config.ts → prisma/schema.prisma
// + prisma/migrations-pg). Até 2026-09-06 passavam `--config prisma.pg.config.ts`
// porque o schema padrão era o espelho SQLite; com um schema só (Task 1.1 da
// preparação arquitetural) não há mais o que apontar.
// Saída do prisma pode passar de 1 MB em deploys com muitas migrations; o
// default do spawnSync (1 MB) mataria o filho com ENOBUFS.
const MAX_BUFFER = 64 * 1024 * 1024

function log(mensagem) {
  console.log(`[migrate-deploy] ${mensagem}`)
}

/**
 * Roda `npx prisma <args>` e SEMPRE imprime stdout+stderr do filho — a
 * revisão de 2026-09-06 pegou que a saída de um passo só aparecia no erro,
 * o que escondia avisos do Prisma no log da Vercel.
 *
 * @param {string[]} args
 * @param {string} rotulo
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ status: number, saida: string }}
 */
/**
 * Heap para o filho: o `prisma generate` do Prisma 7 escreve o client de
 * ~277 modelos em TypeScript e, com o heap padrão do Node (~2 GB no build da
 * Vercel), estourou em 2026-10-13 ("JavaScript heap out of memory" logo após
 * "Loaded Prisma config"). Este script roda ANTES do `build:next`, que é quem
 * dá 6 GB ao tsc e ao next — aqui ninguém dava nada. Quem já traz o limite no
 * NODE_OPTIONS fica com o seu.
 */
function comHeap(env) {
  const atual = env.NODE_OPTIONS ?? ''
  if (/max-old-space-size/.test(atual)) return env
  return { ...env, NODE_OPTIONS: `${atual} --max-old-space-size=4096`.trim() }
}

function rodarPrisma(args, rotulo, env) {
  log(rotulo)
  const r = spawnSync('npx', ['prisma', ...args], {
    env: comHeap(env),
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.error) {
    console.error(`[migrate-deploy] falha ao executar o prisma (${rotulo}): ${r.error.message}`)
    process.exit(1)
  }
  return { status: r.status ?? 1, saida: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}


/**
 * Teto do passo de diagnóstico inteiro. Um diagnóstico NUNCA pode segurar o
 * build: `pg.Client` sem `connectionTimeoutMillis` espera para sempre num
 * host inalcançável, e aí o build morre no teto da Vercel — o mesmo defeito
 * que este script existe para evitar. Cinto (opções do cliente) e suspensório
 * (corrida com relógio), porque as opções do driver não cobrem todo caminho
 * (resolução de DNS, handshake TLS pendurado).
 */
const DIAGNOSTICO_TIMEOUT_MS = Number(process.env.MIGRATE_DIAGNOSTICO_TIMEOUT_MS ?? 15_000)
// O driver desiste ANTES do relógio de fora, senão os dois disparam juntos e o
// log ganha dois avisos para um problema só.
const DIAGNOSTICO_DRIVER_MS = Math.max(1000, Math.round(DIAGNOSTICO_TIMEOUT_MS * 0.8))

/** @template T @param {Promise<T>} promessa @param {number} ms @returns {Promise<T>} */
function comPrazo(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => {
      const t = setTimeout(() => reject(new Error(`diagnóstico passou de ${ms}ms`)), ms)
      t.unref?.()
    }),
  ])
}

/**
 * Uma pergunta só ao Postgres, com o cliente já aberto. Erro de conexão aqui
 * NÃO derruba o build: o `migrate deploy` logo abaixo falha com mensagem
 * melhor, e este passo é diagnóstico, não portão.
 *
 * @param {string} url
 * @returns {Promise<{ baseline: boolean, falhadas: unknown[] | null, travas: unknown[] | null }>}
 */
async function inspecionarBanco(url) {
  return comPrazo(inspecaoCrua(url), DIAGNOSTICO_TIMEOUT_MS).catch((e) => {
    log(`aviso: diagnóstico abandonado (${e instanceof Error ? e.message : String(e)}) — seguindo como banco herdado.`)
    return { baseline: true, falhadas: null, travas: null }
  })
}

/** @param {string} url */
async function inspecaoCrua(url) {
  const cliente = new Client({
    connectionString: url,
    application_name: 'migrate-deploy-diagnostico',
    connectionTimeoutMillis: DIAGNOSTICO_DRIVER_MS,
    query_timeout: DIAGNOSTICO_DRIVER_MS,
    statement_timeout: DIAGNOSTICO_DRIVER_MS,
  })
  try {
    await cliente.connect()
    const baseline = await cliente.query('SELECT to_regclass($1) AS tabela', [`public."${TABELA_DA_BASELINE}"`])
    const temTabela = baseline.rows[0]?.tabela != null

    // Banco novo não tem `_prisma_migrations` ainda — perguntar por ela daria
    // 42P01 e o catch abaixo engoliria TAMBÉM a resposta da baseline.
    const existeHistorico = await cliente.query(`SELECT to_regclass('public."_prisma_migrations"') AS tabela`)
    const falhadas = existeHistorico.rows[0]?.tabela == null
      ? []
      : (await cliente.query(SQL_MIGRATIONS_FALHADAS)).rows

    let travas = null
    try {
      travas = (await cliente.query(SQL_TRAVAS)).rows
    } catch (e) {
      // `pg_stat_activity` pode ser restrita ao dono em alguns provedores.
      log(`aviso: não deu para olhar travas (${e instanceof Error ? e.message : String(e)})`)
    }
    return { baseline: temTabela, falhadas, travas }
  } catch (e) {
    log(`aviso: não deu para inspecionar o banco (${e instanceof Error ? e.message : String(e)}) — seguindo como banco herdado.`)
    return { baseline: true, falhadas: null, travas: null }
  } finally {
    await cliente.end().catch(() => {})
  }
}

async function main() {
  // Qual ambiente abriu este passo. Sem isto, o log da Vercel mostra o erro
  // sem dizer QUEM está buildando — e é exatamente essa a informação que
  // falta para achar a variável que falta (achado do Moacy, 2026-09-23).
  const alvo = process.env.VERCEL_TARGET_ENV ?? ''
  const ambiente = process.env.VERCEL_ENV ?? 'desconhecido'
  log(`ambiente: VERCEL_ENV=${ambiente}${alvo ? ` VERCEL_TARGET_ENV=${alvo}` : ''}`)

  let decisao
  try {
    decisao = decidirConexaoMigracao({
      databaseUrl: process.env.DATABASE_URL,
      directUrl: process.env.DIRECT_URL,
      disableLockEnv: process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK,
    })
  } catch (e) {
    console.error(`[migrate-deploy] ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
  const { url, desligarLock, origem } = decisao

  // Um teto para a ESPERA por lock (não para o trabalho): sem ele, um UPDATE
  // atrás de uma transação esquecida aberta espera até a Vercel matar o build
  // aos 45 min — e aí a migration fica pela metade e trava todo deploy
  // seguinte. O advisory lock do Prisma já tem teto próprio (10 s, P1002); o
  // lock de linha não tinha nenhum.
  const teto = Number(process.env.MIGRATE_LOCK_TIMEOUT_MS ?? LOCK_TIMEOUT_PADRAO_MS)
  const comTeto = urlComLockTimeout(url, teto)

  // Nunca imprimir a URL (tem credencial); só a origem e o estado do lock.
  const env = { ...process.env, DATABASE_URL: comTeto.url }
  if (desligarLock) env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1'
  else delete env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK

  log(`conexão: ${origem}`)
  log(`advisory lock: ${desligarLock ? 'DESLIGADO' : 'ligado'}`)
  log(`espera por lock: ${comTeto.motivo}`)
  if (origem === 'DATABASE_URL') {
    log('aviso: configure DIRECT_URL (conexão direta) para migrar com advisory lock.')
  }

  // ── 0/3 diagnóstico ───────────────────────────────────────────────────────
  // Antes de encostar no banco: sobrou migration em falha? tem alguém
  // segurando o lock? As duas perguntas custam milissegundos e são as duas
  // respostas que faltaram no deploy de 24/09/2026, que morreu no teto de
  // build da Vercel sem dizer nada.
  const banco = await inspecionarBanco(url)

  if (banco.travas !== null) {
    const travas = diagnosticoDeTravas(banco.travas)
    log(`0/3 travas: ${travas.mensagem}`)
  }

  if (banco.falhadas !== null) {
    const falhadas = diagnosticoMigrationsFalhadas(banco.falhadas)
    if (falhadas.travado) {
      console.error(`[migrate-deploy] 0/3 ${falhadas.mensagem}`)
      process.exit(1)
    }
    log(`0/3 histórico: ${falhadas.mensagem}`)
  }

  const baseline = decidirBaseline({ tabelaExiste: banco.baseline })
  log(`baseline: ${baseline.motivo}`)

  if (baseline.acao === 'resolver') {
    const resolve = rodarPrisma(
      ['migrate', 'resolve', '--applied', BASELINE],
      `1/3 migrate resolve --applied ${BASELINE}`,
      env,
    )
    if (resolve.status !== 0) {
      if (resolveFoiIdempotente(resolve.saida)) {
        log('baseline já registrada como aplicada (P3008) — seguindo')
      } else {
        console.error('[migrate-deploy] migrate resolve falhou (não era a baseline já registrada).')
        process.exit(1)
      }
    }
  } else {
    log('1/3 migrate resolve PULADO — banco novo')
  }

  const deploy = rodarPrisma(['migrate', 'deploy'], '2/3 migrate deploy', env)
  if (deploy.status !== 0) {
    console.error('[migrate-deploy] migrate deploy falhou.')
    process.exit(1)
  }

  const generate = rodarPrisma(['generate'], '3/3 generate', env)
  if (generate.status !== 0) {
    console.error('[migrate-deploy] prisma generate falhou.')
    process.exit(1)
  }

  log('concluído')
}

main().catch((e) => {
  console.error(`[migrate-deploy] erro inesperado: ${e instanceof Error ? e.stack : String(e)}`)
  process.exit(1)
})
