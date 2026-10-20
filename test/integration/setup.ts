// globalSetup do project `integration` do Vitest (vitest.config.ts).
//
// Roda UMA vez, no processo principal, antes de qualquer arquivo de teste:
//   1. carrega o .env (o worker do vitest não passa pelo Next, então ninguém
//      mais leria o arquivo);
//   2. exige DATABASE_URL_TEST — o banco de teste é TRUNCADO entre testes
//      (test/integration/db.ts), por isso nunca se usa a DATABASE_URL de dev;
//   3. aponta DATABASE_URL para ele: os workers (pool `forks`) herdam o
//      process.env deste processo, e é a DATABASE_URL que lib/prisma.ts lê;
//   4. aplica as migrations (`prisma migrate deploy`) uma vez por execução.
// No CI o serviço postgres do workflow já expõe DATABASE_URL_TEST.
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

export default function setup(): void {
  const urlTeste = (process.env.DATABASE_URL_TEST ?? '').trim()
  if (urlTeste === '') {
    throw new Error(
      'DATABASE_URL_TEST ausente: os testes de integração precisam de um Postgres próprio ' +
        '(em dev: `npm run db:up` e copie o .env.example para .env).',
    )
  }
  process.env.DATABASE_URL = urlTeste

  const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: urlTeste },
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    throw new Error(`prisma migrate deploy falhou no banco de teste:\n${r.stdout ?? ''}${r.stderr ?? ''}`)
  }
}
