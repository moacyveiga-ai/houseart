// Postgres de desenvolvimento SEM Docker — binários nativos do pacote
// `embedded-postgres` (PostgreSQL 17), instalado SOB DEMANDA na primeira
// execução numa árvore npm PRÓPRIA em ~/.cache/houseart/embedded-postgres
// — fora do package.json (CI e Vercel não baixam binário) e fora do
// node_modules do repo (um `npm install`/`npm ci` qualquer PODA o que não está
// no lock: foi assim que o plpgsql sumiu debaixo do servidor em 2026-09-21).
// Cluster em `.pgdata/`
// na raiz do repo (gitignored), na MESMA porta e credenciais do
// docker-compose.yml, para que o `.env.example` sirva igual aos dois caminhos.
//
//   node scripts/db-native.mjs up      initdb (se faltar) + pg_ctl start +
//                                      cria `houseart` e `houseart_test`
//   node scripts/db-native.mjs down    pg_ctl stop
//   node scripts/db-native.mjs status  pg_ctl status
//
// Por que existe: máquinas sem Docker nem Homebrew (e sem senha de admin para
// instalá-los). O caminho Docker (`npm run db:up`) continua sendo o padrão de
// quem o tem; este é o irmão, não o substituto. Ver docs/CONTRIBUINDO.md.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import dotenv from 'dotenv'
import pg from 'pg'

// Versão exata (pré-release): caret aqui aceitaria qualquer beta futuro.
const PACOTE_EMBEDDED = 'embedded-postgres@17.10.0-beta.17'
const PREFIXO_BINARIOS = path.join(os.homedir(), '.cache', 'houseart', 'embedded-postgres')
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PGDATA = path.join(RAIZ, '.pgdata')
const LOG = path.join(RAIZ, '.pgdata.log')
// O .env da RAIZ do repo, não o do cwd: rodado de outro diretório o script
// dizia "DATABASE_URL ausente" com o arquivo lá (revisão da Fase 0).
dotenv.config({ path: path.join(RAIZ, '.env'), quiet: true })
// Sempre 127.0.0.1, nunca `localhost`: o driver `pg` resolve localhost para ::1
// primeiro e mascararia um Postgres que só conseguiu escutar em IPv6 porque
// outro processo ficou com o 127.0.0.1 (revisão da Fase 0).
const HOST = '127.0.0.1'

function falhar(msg) {
  console.error(`[db-native] ${msg}`)
  process.exit(1)
}

// Os binários vêm do pacote de plataforma que o embedded-postgres instala
// como optionalDependency (@embedded-postgres/darwin-arm64, linux-x64…).
function caminhoBinarios() {
  const pacote = `@embedded-postgres/${process.platform}-${process.arch}`
  return path.join(PREFIXO_BINARIOS, 'node_modules', ...pacote.split('/'), 'native', 'bin')
}

function binarios() {
  const bin = caminhoBinarios()
  if (!fs.existsSync(bin)) {
    console.log(`[db-native] instalando ${PACOTE_EMBEDDED} em ${PREFIXO_BINARIOS} (uma vez; fora do repo)`)
    fs.mkdirSync(PREFIXO_BINARIOS, { recursive: true })
    const st = rodar('npm', ['install', '--prefix', PREFIXO_BINARIOS, '--no-audit', '--no-fund', '--no-package-lock', PACOTE_EMBEDDED], { cwd: PREFIXO_BINARIOS })
    if (st !== 0 || !fs.existsSync(bin)) {
      falhar(`binários não encontrados em ${bin} — a plataforma ${process.platform}-${process.arch} precisa ter pacote no embedded-postgres.`)
    }
  }
  for (const nome of ['initdb', 'pg_ctl', 'postgres']) {
    if (!fs.existsSync(path.join(bin, nome))) falhar(`faltou ${nome} em ${bin}`)
  }
  return bin
}

// user/senha/porta vêm da DATABASE_URL do .env — a fonte única; sem ela o
// próprio app recusa abrir, então aqui também.
function credenciais() {
  const url = (process.env.DATABASE_URL ?? '').trim()
  if (url === '') falhar('DATABASE_URL ausente — copie o .env.example para .env.')
  const u = new URL(url)
  if (!['postgresql:', 'postgres:'].includes(u.protocol)) falhar('DATABASE_URL não é Postgres.')
  return {
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || 'postgres'),
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  }
}

function rodar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.error) falhar(`${path.basename(cmd)}: ${r.error.message}`)
  return r.status ?? 1
}

async function garantirBanco(cred, nome) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(nome)) falhar(`nome de banco inesperado: "${nome}"`)
  const cliente = new pg.Client({
    host: HOST, port: cred.port, user: cred.user, password: cred.password, database: 'postgres',
  })
  await cliente.connect()
  try {
    const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome])
    if (rowCount === 0) {
      await cliente.query(`CREATE DATABASE "${nome}"`)
      console.log(`[db-native] banco "${nome}" criado`)
    } else {
      console.log(`[db-native] banco "${nome}" já existe`)
    }
  } finally {
    await cliente.end()
  }
}

function portaOcupada(porta) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port: porta, host: HOST })
    s.once('connect', () => { s.destroy(); resolve(true) })
    s.once('error', () => resolve(false))
  })
}

// 60 s: o mesmo teto do `pg_ctl -w` (um Mac frio com recovery passa de 10 s).
async function esperarPronto(cred, tentativas = 240) {
  for (let i = 0; i < tentativas; i++) {
    const cliente = new pg.Client({
      host: HOST, port: cred.port, user: cred.user, password: cred.password, database: 'postgres',
    })
    try {
      await cliente.connect()
      // Quem está na porta é ESTE cluster? Sem isto, um compose ou outro
      // Postgres na 5435 receberia os bancos e o script diria "no ar".
      const { rows } = await cliente.query("SELECT current_setting('data_directory') AS dir")
      await cliente.end()
      const dir = fs.realpathSync(rows[0].dir)
      if (dir !== fs.realpathSync(PGDATA)) {
        falhar(`a porta ${cred.port} está servida por OUTRO Postgres (data_directory=${dir}); pare-o (docker compose down?) ou mude a porta na DATABASE_URL.`)
      }
      return
    } catch (e) {
      if (e && e.code === '28P01') {
        falhar(`senha da DATABASE_URL difere da senha do cluster em ${PGDATA} (definida no initdb) — \`npm run db:reset:native\` recria com a atual.`)
      }
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  falhar(`o Postgres não respondeu na porta ${cred.port} em 60 s (veja ${LOG}).`)
}

async function up() {
  const bin = binarios()
  const cred = credenciais()
  if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    console.log(`[db-native] initdb em ${PGDATA}`)
    // A senha vai por arquivo temporário (initdb não a aceita por argumento);
    // trust só no socket local, scram na rede — igual ao container.
    const pw = path.join(os.tmpdir(), `hb-pw-${process.pid}`)
    fs.writeFileSync(pw, `${cred.password}\n`, { mode: 0o600, flag: 'wx' })
    try {
      const st = rodar(path.join(bin, 'initdb'), [
        '-D', PGDATA, '-U', cred.user, `--pwfile=${pw}`,
        '--auth-local=trust', '--auth-host=scram-sha-256',
        // en_US.UTF-8 como a imagem oficial do Postgres e o Neon (glibc): com
        // `C`, ORDER BY em texto ordenaria por byte (maiúsculas antes, acento
        // depois de z) e o dev divergiria de produção. Nenhuma migration fixa
        // COLLATE, então é o initdb que garante a paridade.
        '-E', 'UTF8', '--locale=en_US.UTF-8',
        // Gravado no postgresql.conf: sem isto o initdb escolhe o fuso da
        // máquina (America/Bahia) e só o `-c` do start o corrigia em runtime.
        '-c', 'timezone=UTC', '-c', 'log_timezone=UTC',
      ])
      if (st !== 0) falhar('initdb falhou.')
    } finally {
      fs.rmSync(pw, { force: true })
    }
  }
  let status = spawnSync(path.join(bin, 'pg_ctl'), ['-D', PGDATA, 'status'], { encoding: 'utf8' })
  if (status.status === 0) {
    // `pg_ctl status` confia no postmaster.pid. Depois de um reboot duro o
    // arquivo sobra, e se o PID foi reaproveitado por outro processo ele
    // mente ("server is running") — e o `down` mandaria SIGTERM a um
    // estranho. Confere que o PID é mesmo um postgres e que a porta é a do .env.
    const [pidStr, , , portaStr] = fs.readFileSync(path.join(PGDATA, 'postmaster.pid'), 'utf8').split('\n')
    const comm = spawnSync('ps', ['-o', 'comm=', '-p', pidStr.trim()], { encoding: 'utf8' }).stdout.trim()
    if (!/postgres/.test(comm)) {
      console.log(`[db-native] postmaster.pid apontava para o PID ${pidStr.trim()} (${comm || 'inexistente'}), não um postgres — arquivo stale removido`)
      fs.rmSync(path.join(PGDATA, 'postmaster.pid'), { force: true })
      status = { status: 1 }
    } else if (Number(portaStr) !== cred.port) {
      falhar(`o cluster está no ar na porta ${Number(portaStr)}, mas a DATABASE_URL pede ${cred.port} — rode \`npm run db:down:native\` e depois \`db:up:native\`.`)
    } else {
      console.log('[db-native] já estava no ar')
    }
  }
  if (status.status !== 0) {
    if (await portaOcupada(cred.port)) {
      falhar(`a porta ${cred.port} já está ocupada por outro processo (o cluster de ${PGDATA} está parado) — pare-o ou mude a porta na DATABASE_URL.`)
    }
    // UTC de propósito: produção é UTC; TTLs "expirando na hora" já foram
    // registrados quando um banco de dev nasceu em UTC-3.
    // Só o que ESTE start escrever no log conta (o arquivo acumula starts antigos).
    const logAntes = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0
    const st = rodar(path.join(bin, 'pg_ctl'), [
      '-D', PGDATA, '-l', LOG, '-w', 'start',
      '-o', `-p ${cred.port} -c listen_addresses=localhost -c timezone=UTC -c log_min_messages=warning`,
    ])
    if (st !== 0) falhar(`pg_ctl start falhou (veja ${LOG}).`)
    // Colisão PARCIAL: outro processo no 127.0.0.1 e o postgres sobe só em ::1
    // (o pg_ctl considera sucesso). Quem resolve localhost para IPv4 cairia no
    // estranho, longe daqui.
    const cauda = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').slice(logAntes) : ''
    if (/could not bind/.test(cauda)) {
      spawnSync(path.join(bin, 'pg_ctl'), ['-D', PGDATA, '-m', 'fast', 'stop'], { stdio: 'ignore' })
      falhar(`o Postgres subiu só em parte da porta ${cred.port} ("could not bind" em ${LOG}): outro processo ocupa o 127.0.0.1 — pare-o e rode de novo.`)
    }
  }
  await esperarPronto(cred)
  await garantirBanco(cred, cred.database)
  // O banco de teste (DATABASE_URL_TEST) é criado pelo mesmo script que o
  // caminho Docker usa — uma regra só para os dois.
  const st = rodar(process.execPath, [path.join(RAIZ, 'scripts', 'db-preparar.mjs')])
  if (st !== 0) falhar('db-preparar falhou.')
  console.log(`[db-native] Postgres ${cred.port} · ${cred.database} · UTC · dados em ${PGDATA}`)
}

function down() {
  if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    console.log('[db-native] nenhum cluster em .pgdata — nada a parar')
    return
  }
  // Sem os binários (apagados ou movidos) ainda dá para parar o servidor: o
  // postmaster.pid guarda o PID e SIGINT é o "fast shutdown" do postgres.
  if (!fs.existsSync(caminhoBinarios())) {
    const pidFile = path.join(PGDATA, 'postmaster.pid')
    if (!fs.existsSync(pidFile)) { console.log('[db-native] cluster parado (sem binários e sem postmaster.pid)'); return }
    const pid = Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0])
    const comm = spawnSync('ps', ['-o', 'comm=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim()
    if (/postgres/.test(comm)) { process.kill(pid, 'SIGINT'); console.log(`[db-native] SIGINT enviado ao postgres ${pid} (binários ausentes)`) }
    else { fs.rmSync(pidFile, { force: true }); console.log('[db-native] postmaster.pid stale removido') }
    return
  }
  const bin = binarios()
  // -t 120: um checkpoint pesado (migrations + testes) já levou 42 s; com o
  // padrão de 60 s o pg_ctl desistiria e deixaria o cluster meio vivo.
  const st = rodar(path.join(bin, 'pg_ctl'), ['-D', PGDATA, '-m', 'fast', '-t', '120', 'stop'])
  if (st !== 0) console.log('[db-native] pg_ctl stop devolveu erro (provavelmente já estava parado)')
}

function status() {
  const bin = binarios()
  process.exit(rodar(path.join(bin, 'pg_ctl'), ['-D', PGDATA, 'status']))
}

const acao = process.argv[2]
if (acao === 'up') await up()
else if (acao === 'down') down()
else if (acao === 'status') status()
else falhar('uso: node scripts/db-native.mjs up|down|status')
