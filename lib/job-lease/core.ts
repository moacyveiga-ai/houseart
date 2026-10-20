// Job lease — the PURE half of the overlapping-run guard for /api/jobs/* and
// /api/cron/* (audit 2026-10-11, A-TEN-15). No prisma, no env: the I/O lives
// in ./server.ts and the wiring in `comJob` (lib/jobs/auth.ts).

/** The largest `maxDuration` among the job routes (300 s). */
export const JOB_LEASE_DEFAULT_MS = 300_000

/** Hard ceiling for a per-route lease (Vercel's longest function duration). */
const JOB_LEASE_MAX_MS = 900_000

/** A positive integer up to 900 s is used as given; anything else falls back to the default. */
export function leaseMs(opt?: number): number {
  if (opt === undefined || !Number.isInteger(opt) || opt <= 0 || opt > JOB_LEASE_MAX_MS) return JOB_LEASE_DEFAULT_MS
  return opt
}

/** Body of the run that found the lease taken: 200, never an error (the cron must not alert). */
export function skippedBody(job: string): { ok: true; job: string; skipped: 'running' } {
  return { ok: true, job, skipped: 'running' }
}
