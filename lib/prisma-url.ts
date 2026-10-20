// PURE classification of DATABASE_URL — decides what lib/prisma.ts opens.
// No I/O, no process.env: the caller passes the URL.
//
// Rule: a recognised Postgres scheme (`postgres:`, `postgresql:`, `prisma:`,
// `prisma+postgres:`) → 'postgres' (the `pg` adapter, plain TCP: local
// Postgres, CI, Supabase). Empty or unknown scheme → 'error' in EVERY
// environment. There is no fallback (ported from the Housebroker, where a
// silent SQLite fallback once hid a typo).

export type DatabaseUrlClass = 'postgres' | 'error'

export const DATABASE_URL_ERROR =
  'DATABASE_URL missing or invalid: it must be Postgres (postgres://, postgresql://, ' +
  'prisma+postgres://) in every environment — in dev, start the database (npm run db:up:native) and copy ' +
  '.env.example to .env. An unrecognised URL is refused.'

const POSTGRES_SCHEMES = new Set(['postgres:', 'postgresql:', 'prisma:', 'prisma+postgres:'])

function schemeOf(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url)
  return m ? `${m[1].toLowerCase()}:` : null
}

export function classifyDatabaseUrl(url: string | undefined): DatabaseUrlClass {
  const value = (url ?? '').trim()
  if (value === '') return 'error'
  const scheme = schemeOf(value)
  if (scheme === null || !POSTGRES_SCHEMES.has(scheme)) return 'error'
  return 'postgres'
}
