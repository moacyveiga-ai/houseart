// Job runs — the trail of every cron run (`withJob`) and every webhook delivery that failed, read by
// Admin › Saúde operacional. Same shape as lib/job-lease/server.ts: the client is INJECTED by
// lib/prisma.ts (this module sits under lib/jobs, inside the import cycle) and nothing here throws
// into the caller — a job that cannot write its trail still runs.
export interface JobRunDb {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<number>
}

let db: JobRunDb | null = null
export function attachJobRunDb(client: JobRunDb | null): void { db = client }

export const SUMMARY_MAX = 500
const cut = (v: string | null | undefined) => (v ? v.slice(0, SUMMARY_MAX) : null)

/** A RUNNING row older than this was killed by the platform before `finally` ran (Vercel's maxDuration); it is closed as a timeout. */
export const STALE_RUNNING_MINUTES = 15
/** The trail is kept this long; `pruneJobRuns` runs inside the daily cron. */
export const RETENTION_DAYS = 90

/** Opens the row of a run; `null` when the trail is unavailable (never fails the job). A stale RUNNING row of the same job is closed first. */
export async function startJobRun(kind: 'CRON' | 'WEBHOOK', name: string, runId: string | null): Promise<number | null> {
  if (!db) return null
  try {
    await db.$executeRaw`UPDATE "JobRun" SET "status" = 'FAILED', "error" = 'timeout', "finishedAt" = (now() AT TIME ZONE 'UTC') WHERE "name" = ${name} AND "status" = 'RUNNING' AND "startedAt" < (now() AT TIME ZONE 'UTC') - (${STALE_RUNNING_MINUTES} * interval '1 minute')`
    const rows = await db.$queryRaw<{ id: number }[]>`INSERT INTO "JobRun" ("kind", "name", "runId", "status", "startedAt") VALUES (${kind}, ${name}, ${runId}, 'RUNNING', (now() AT TIME ZONE 'UTC')) RETURNING "id"`
    return rows[0]?.id ?? null
  } catch (e) { console.warn(JSON.stringify({ level: 'warn', evt: 'job_run_trail_failed', job: name, error: e instanceof Error ? e.name : 'unknown' })); return null }
}

export async function finishJobRun(id: number | null, r: { status: 'OK' | 'FAILED' | 'SKIPPED'; httpStatus: number; ms: number; error?: string | null; summary?: string | null }): Promise<void> {
  if (!db || id === null) return
  try {
    await db.$executeRaw`UPDATE "JobRun" SET "status" = ${r.status}, "httpStatus" = ${r.httpStatus}, "ms" = ${r.ms}, "error" = ${r.error ?? null}, "summary" = ${cut(r.summary)}, "finishedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${id}`
  } catch (e) { console.warn(JSON.stringify({ level: 'warn', evt: 'job_run_trail_failed', id, error: e instanceof Error ? e.name : 'unknown' })) }
}

/** A webhook delivery the handler could not process (Stripe retries; the team sees it in Saúde). Never the payload. */
export async function recordWebhookFailure(name: string, error: string): Promise<void> {
  if (!db) return
  try {
    await db.$executeRaw`INSERT INTO "JobRun" ("kind", "name", "status", "startedAt", "finishedAt", "httpStatus", "error") VALUES ('WEBHOOK', ${name}, 'FAILED', (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'), 500, ${error.slice(0, 120)})`
  } catch (e) { console.warn(JSON.stringify({ level: 'warn', evt: 'job_run_trail_failed', job: name, error: e instanceof Error ? e.name : 'unknown' })) }
}

/** Deletes the rows older than the retention; returns how many went (0 when the trail is unavailable). */
export async function pruneJobRuns(days = RETENTION_DAYS): Promise<number> {
  if (!db) return 0
  try {
    return await db.$executeRaw`DELETE FROM "JobRun" WHERE "startedAt" < (now() AT TIME ZONE 'UTC') - (${days} * interval '1 day')`
  } catch (e) { console.warn(JSON.stringify({ level: 'warn', evt: 'job_run_prune_failed', error: e instanceof Error ? e.name : 'unknown' })); return 0 }
}
