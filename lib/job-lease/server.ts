// Job lease — the database half (audit 2026-10-11, A-TEN-15). One `JobLease`
// row per job name. Acquire is a single atomic statement: it inserts the row,
// or takes over a row whose `lockedUntil` already passed; a live lease makes
// the upsert's WHERE false and RETURNING comes back empty. Release only moves
// `lockedUntil` to now for the run that owns it.
//
// Every instant is `now() AT TIME ZONE 'UTC'`: the columns are `timestamp(3)`
// without zone holding UTC (what Prisma writes and reads), and a bare now()
// would be cast through the session time zone.
//
// Not an advisory lock: the production DATABASE_URL is the pooler in
// transaction mode — a session lock would stay pinned to a pooled connection,
// and a transaction-scoped one would need a transaction held open for the
// whole handler.
//
// The client is INJECTED (`attachJobLeaseDb`, called by lib/prisma.ts when
// the client module loads), not imported: `comJob` (lib/jobs) imports this
// module, lib/jobs sits inside the lib/ import cycle, and an import of
// lib/prisma from here would widen that cycle (lib/architecture/
// import-cycles.test.ts). This module imports nothing from lib/.
import { randomUUID } from 'node:crypto'

/** The two raw-SQL methods of the Prisma client this module uses. */
export interface JobLeaseDb {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<number>
}

let db: JobLeaseDb | null = null

/** Wires the Prisma client in (lib/prisma.ts). `null` detaches (tests). */
export function attachJobLeaseDb(client: JobLeaseDb | null): void {
  db = client
}

function store(): JobLeaseDb {
  // Fails closed: a job without its lease store does not run (comJob → 500, logged).
  if (!db) throw new Error('JobLease: banco não anexado (lib/prisma.ts chama attachJobLeaseDb)')
  return db
}

/** The run id that now owns the lease, or `null` when another run holds it. */
export async function acquireJobLease(name: string, ms: number): Promise<string | null> {
  const runId = randomUUID()
  const rows = await store().$queryRaw<{ runId: string }[]>`
    INSERT INTO "JobLease" ("name", "runId", "lockedUntil", "updatedAt")
    VALUES (
      ${name}, ${runId},
      (now() AT TIME ZONE 'UTC') + (${ms}::double precision * interval '1 millisecond'),
      (now() AT TIME ZONE 'UTC')
    )
    ON CONFLICT ("name") DO UPDATE
      SET "runId" = EXCLUDED."runId", "lockedUntil" = EXCLUDED."lockedUntil", "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "JobLease"."lockedUntil" < (now() AT TIME ZONE 'UTC')
    RETURNING "runId"`
  return rows[0]?.runId === runId ? runId : null
}

/** Frees the lease if this run still owns it (a lease taken over after expiry is left alone). */
export async function releaseJobLease(name: string, runId: string): Promise<void> {
  await store().$executeRaw`
    UPDATE "JobLease" SET "lockedUntil" = (now() AT TIME ZONE 'UTC'), "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "name" = ${name} AND "runId" = ${runId}`
}
