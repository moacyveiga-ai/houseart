// `npm run db:migrate:test`: applies prisma/migrations to DATABASE_URL_TEST.
// The integration globalSetup does the same; this is the manual door.
import { spawnSync } from 'node:child_process'
import dotenv from 'dotenv'
dotenv.config({ quiet: true })
const url = (process.env.DATABASE_URL_TEST ?? '').trim()
if (!url) { console.error('[db-prepare] DATABASE_URL_TEST missing in .env'); process.exit(1) }
if (!/houseart_test/.test(url)) { console.error('[db-prepare] DATABASE_URL_TEST must point to the houseart_test database'); process.exit(1) }
const st = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } })
process.exit(st.status ?? 1)
