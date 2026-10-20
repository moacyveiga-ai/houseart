// Núcleo PURO do deploy de migrations (sem I/O) — a decisão sobre a conexão e
// o advisory lock, e a leitura da saída do `prisma migrate resolve`. O arquivo
// que roda os comandos é scripts/migrate-deploy.mjs; este só decide, para ser
// testável.

/**
 * Código do Prisma quando a migration já está marcada na `_prisma_migrations`
 * ("The migration `X` is already recorded as applied in the database.").
 * Comparamos pelo CÓDIGO, não pela frase em inglês: a frase pode mudar entre
 * versões do schema engine; o código é a interface estável (revisão 2026-09-06).
 */
export const CODIGO_RESOLVE_IDEMPOTENTE = 'P3008'

/**
 * Decide com qual URL o Prisma roda as migrations e se o advisory lock precisa
 * ser desligado.
 *
 * A revisão de 2026-09-06 tirou daqui a heurística de "detectar pooler pela
 * URL" (`-pooler.`, `pooler.supabase.com`, `pgbouncer=true`): era frágil
 * (falso negativo = migrate travando num pooler não reconhecido) e escondia
 * a regra real, que é simples:
 *
 * - `DIRECT_URL` presente → conexão direta, lock LIGADO (é a proteção contra
 *   dois deploys migrando ao mesmo tempo).
 * - só `DATABASE_URL` → lock DESLIGADO. É o comportamento que a Vercel sempre
 *   teve (a linha antiga fixava `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`) e é
 *   honesto: sem saber se a URL é pooler, a opção segura é não travar.
 * - `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` explícito no ambiente → lock
 *   DESLIGADO sempre; a variável da Vercel continua sendo um override válido.
 * - nenhuma URL → ERRO. Este script só é chamado no ambiente de PRODUÇÃO
 *   (package.json, `migrate:pg:deploy:ci`), que desde 2026-09-23 é o ambiente
 *   ÚNICO do projeto, e ele PRECISA de banco:
 *   `lib/prisma.ts` não tem fallback, então subir sem banco entregaria um app
 *   que responde 500 em tudo. Falhar o build é a opção honesta.
 *
 * @param {{ databaseUrl?: string, directUrl?: string, disableLockEnv?: string }} entrada
 * @returns {{ url: string, desligarLock: boolean, origem: 'DIRECT_URL' | 'DATABASE_URL' }}
 */
export function decidirConexaoMigracao({ databaseUrl, directUrl, disableLockEnv }) {
  const overrideDesliga = (disableLockEnv ?? '').trim() === '1'
  const direta = (directUrl ?? '').trim()
  if (direta !== '') {
    return { url: direta, desligarLock: overrideDesliga, origem: 'DIRECT_URL' }
  }

  const url = (databaseUrl ?? '').trim()
  if (url === '') {
    throw new Error(
      'DATABASE_URL e DIRECT_URL ausentes neste ambiente. Este passo só roda em produção — ' +
        'o ambiente ÚNICO do projeto desde 2026-09-23 — e ela precisa de banco: sem ele o app ' +
        'subiria respondendo 500 em toda rota. Configure as variáveis no projeto da Vercel PARA ' +
        'O AMBIENTE QUE ESTÁ BUILDANDO (a linha `[migrate-deploy] ambiente:` acima diz qual é; ' +
        'variável marcada para um ambiente NÃO chega aos outros): DATABASE_URL = pooler ' +
        '(Supavisor, porta 6543) e DIRECT_URL = conexão direta (porta 5432). ' +
        'Ver docs/RUNBOOK-SUPABASE-DB.md §0.',
    )
  }
  return { url, desligarLock: true, origem: 'DATABASE_URL' }
}

/**
 * `true` só quando a falha do `prisma migrate resolve --applied` é a
 * idempotente (baseline já registrada, P3008) — qualquer outra saída é erro
 * real.
 *
 * @param {string} saida stdout + stderr do comando
 * @returns {boolean}
 */
export function resolveFoiIdempotente(saida) {
  return (saida ?? '').includes(CODIGO_RESOLVE_IDEMPOTENTE)
}

/**
 * Uma tabela criada pela PRÓPRIA baseline (`20260701193536_baseline`). A
 * presença dela no banco é o que distingue os dois mundos abaixo.
 */
export const TABELA_DA_BASELINE = 'Tenant'

/**
 * Decide o que fazer com a baseline ANTES do `migrate deploy`.
 *
 * A baseline não é uma migration comum: ela existe porque o banco do Neon já
 * tinha as tabelas quando o Prisma entrou. Nesse banco, rodá-la seria erro
 * (`CREATE TABLE` em tabela existente), e por isso o deploy sempre a marcava
 * como aplicada (`migrate resolve --applied`).
 *
 * Num banco VAZIO (ambiente novo — o Supabase da Viby, 2026-09-15) essa mesma
 * marcação é um desastre silencioso: as 57 tabelas da baseline nunca nascem,
 * e a migration seguinte (`20260702143654_marketplace_deal`) falha com
 * `42P01 relation "MarketplaceListing" does not exist`, deixando a linha
 * FALHOU na `_prisma_migrations` — o banco fica travado até alguém limpar a
 * mão.
 *
 * A regra é a pergunta honesta: **a baseline já está no banco?**
 * - tabela existe → banco herdado (Neon): marcar como aplicada, como sempre.
 * - tabela não existe → banco novo: deixar o `migrate deploy` APLICAR a
 *   baseline de verdade, como qualquer outra migration.
 *
 * @param {{ tabelaExiste: boolean }} entrada
 * @returns {{ acao: 'resolver' | 'aplicar', motivo: string }}
 */
export function decidirBaseline({ tabelaExiste }) {
  return tabelaExiste
    ? { acao: 'resolver', motivo: `banco herdado (${TABELA_DA_BASELINE} existe) — baseline marcada como aplicada` }
    : { acao: 'aplicar', motivo: `banco novo (${TABELA_DA_BASELINE} não existe) — baseline será aplicada pelo deploy` }
}

// ── Diagnóstico ANTES de migrar (2026-09-24) ────────────────────────────────
//
// Por que isto existe: o deploy de `f2026c30` ficou 46 minutos preso e morreu
// no teto de build da Vercel, com uma linha de "Deployment has failed" e nada
// mais. A cadeia de migrations e o `next build` passam na CI — o que a CI
// NUNCA roda é o `migrate deploy` contra o banco de produção. Então as duas
// coisas que só acontecem lá viram pergunta feita ANTES, e respondida em
// segundos no log:
//
//   1. sobrou migration em falha de um deploy anterior? (P3009: o Prisma
//      recusa tudo até alguém resolver — um deploy quebrado trava TODOS os
//      seguintes, inclusive os que não têm nada a ver);
//   2. tem alguém segurando o advisory lock ou uma transação aberta? (é o que
//      faz o `migrate deploy` esperar para sempre).
//
// Tudo aqui é LEITURA. Nada é morto no meio do caminho de propósito: matar um
// `migrate deploy` durante um DDL longo é exatamente o que CRIA o estado
// travado do item 1.

/** Migrations começadas e nunca terminadas — o estado que gera P3009. */
export const SQL_MIGRATIONS_FALHADAS = `
  SELECT migration_name, started_at, logs
    FROM "_prisma_migrations"
   WHERE finished_at IS NULL
     AND rolled_back_at IS NULL
   ORDER BY started_at
`

/**
 * Advisory locks vivos e transações abertas há mais de um minuto. O `query`
 * NÃO é lido de propósito: ele pode carregar dado de cliente, e o que
 * interessa aqui é quem está segurando, desde quando e esperando o quê.
 */
export const SQL_TRAVAS = `
  SELECT a.pid,
         a.state,
         a.wait_event_type,
         a.application_name,
         EXTRACT(EPOCH FROM (now() - a.xact_start))::int AS segundos_em_transacao,
         EXISTS (SELECT 1 FROM pg_locks l
                  WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted) AS tem_advisory
    FROM pg_stat_activity a
   WHERE a.datname = current_database()
     AND a.pid <> pg_backend_pid()
     AND (a.xact_start < now() - interval '1 minute'
          OR EXISTS (SELECT 1 FROM pg_locks l
                      WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted))
   ORDER BY a.xact_start
`

/**
 * O relatório das migrations em falha. `travado: true` significa que o
 * `migrate deploy` vai recusar tudo (P3009) — não adianta tentar de novo.
 *
 * O conselho é deliberadamente uma PERGUNTA, não um comando pronto: só quem
 * lê o SQL da migration sabe se ela chegou a fazer efeito. `--rolled-back`
 * diz "não valeu, aplique de novo" e só é seguro quando a migration é
 * reexecutável; `--applied` diz "já valeu, pule" e é o caminho quando o
 * efeito está no banco. Errar isso em produção é pior que o build vermelho.
 *
 * @param {{ migration_name: string, started_at?: Date | string | null }[]} linhas
 * @returns {{ travado: boolean, mensagem: string }}
 */
export function diagnosticoMigrationsFalhadas(linhas) {
  const lista = linhas ?? []
  if (lista.length === 0) {
    return { travado: false, mensagem: 'nenhuma migration em falha — o banco aceita deploy' }
  }
  const nomes = lista.map((l) => l.migration_name)
  const linhasTexto = lista.map((l) => {
    const quando = l.started_at ? new Date(l.started_at).toISOString() : 'início desconhecido'
    return `    · ${l.migration_name} (começou em ${quando}, nunca terminou)`
  })
  return {
    travado: true,
    mensagem: [
      `${lista.length} migration(s) começaram e não terminaram. O Prisma vai recusar QUALQUER deploy`,
      'enquanto isso não for resolvido (P3009) — inclusive deploys que nada têm a ver com elas.',
      ...linhasTexto,
      '',
      '  Como sair: leia o SQL de cada uma e decida o que aconteceu no banco.',
      `    · não chegou a fazer efeito (ou é reexecutável) → npx prisma migrate resolve --rolled-back ${nomes[0]}`,
      `    · o efeito já está no banco                     → npx prisma migrate resolve --applied ${nomes[0]}`,
      '  Rode isso com a DIRECT_URL de produção, fora do build, e faça um deploy novo em seguida.',
    ].join('\n'),
  }
}

/**
 * O relatório de quem pode estar segurando o `migrate deploy`.
 *
 * @param {{ pid: number, state?: string | null, wait_event_type?: string | null, application_name?: string | null, segundos_em_transacao?: number | null, tem_advisory?: boolean }[]} linhas
 * @returns {{ suspeito: boolean, mensagem: string }}
 */
export function diagnosticoDeTravas(linhas) {
  const lista = linhas ?? []
  const comAdvisory = lista.filter((l) => l.tem_advisory)
  if (lista.length === 0) {
    return { suspeito: false, mensagem: 'sem advisory lock preso nem transação aberta — caminho livre' }
  }
  const texto = lista.map((l) => {
    const idade = l.segundos_em_transacao == null ? 'sem transação aberta' : `transação aberta há ${l.segundos_em_transacao}s`
    const adv = l.tem_advisory ? ', SEGURANDO advisory lock' : ''
    return `    · pid ${l.pid} (${l.application_name || 'sem nome'}) — ${l.state || 'estado desconhecido'}, ${idade}${adv}, esperando ${l.wait_event_type || 'nada'}`
  })
  return {
    suspeito: comAdvisory.length > 0,
    mensagem: [
      comAdvisory.length > 0
        ? `${comAdvisory.length} sessão(ões) segurando advisory lock — é o que faz o migrate deploy esperar para sempre:`
        : `${lista.length} sessão(ões) com transação aberta há mais de um minuto (nenhuma com advisory lock):`,
      ...texto,
    ].join('\n'),
  }
}

/**
 * Quanto tempo o migrate pode ESPERAR por um lock antes de desistir. Não é
 * limite de trabalho: `lock_timeout` só conta enquanto a instrução está na
 * fila de um lock. Um `CREATE INDEX` de uma hora não é afetado; um `UPDATE`
 * atrás de uma transação que alguém esqueceu aberta morre em 15 s.
 *
 * Era isto que faltava em 24/09/2026: o advisory lock do Prisma tem timeout
 * de 10 s (P1002), mas o lock de LINHA não tem nenhum — o `migrate deploy`
 * esperou até a Vercel matar o build aos 45 minutos, e a migration ficou
 * pela metade na `_prisma_migrations`, o que trava todo deploy seguinte.
 */
export const LOCK_TIMEOUT_PADRAO_MS = 15_000

/**
 * Devolve a URL com `lock_timeout` na sessão, pelo parâmetro `options` do
 * Postgres. Conservadora de propósito:
 *
 * - URL que não parseia volta intacta (nada de quebrar o deploy por causa de
 *   um diagnóstico);
 * - `options` já presente é RESPEITADA: quem configurou a env sabe o que quis,
 *   e colar duas `-c` no lugar errado corromperia a conexão.
 *
 * @param {string} url
 * @param {number} ms
 * @returns {{ url: string, aplicado: boolean, motivo: string }}
 */
export function urlComLockTimeout(url, ms = LOCK_TIMEOUT_PADRAO_MS) {
  const limite = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : LOCK_TIMEOUT_PADRAO_MS
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { url, aplicado: false, motivo: 'URL não parseável — seguindo sem lock_timeout' }
  }
  if (parsed.searchParams.has('options')) {
    return { url, aplicado: false, motivo: 'a URL já traz `options` — respeitando o que está configurado' }
  }
  // Escrito à mão, e não por `searchParams.set`: o serializador do
  // URLSearchParams escreve o espaço como `+`, e o parser de URL do Prisma
  // (Rust) só faz percent-decoding — o servidor receberia
  // `-c+lock_timeout=15000` e recusaria a conexão. O separador tem de ser
  // `%20` literal.
  const sep = parsed.search ? '&' : '?'
  return {
    url: `${url}${sep}options=-c%20lock_timeout%3D${limite}`,
    aplicado: true,
    motivo: `lock_timeout=${limite}ms`,
  }
}

