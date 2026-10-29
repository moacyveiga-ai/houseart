// Admin › Saúde operacional — pure rules (audit 2026-10-25, web-app §5: "crons e webhooks com
// erro"). The cron catalog (mirrors vercel.json; the unit test keeps them equal), the interval a
// schedule implies, the health of each job from its trail, and the webhook picture.
export interface CronSpec { name: string; path: string; schedule: string; label: string; what: string }

/** The crons of vercel.json (lib/architecture: the unit test refuses a drift between the two). */
export const CRONS: readonly CronSpec[] = [
  { name: 'certificate-anchor', path: '/api/cron/certificate-anchor', schedule: '20 3 * * *', label: 'Âncora dos certificados', what: 'raiz Merkle do dia' },
  { name: 'offers-expire', path: '/api/cron/offers-expire', schedule: '15 * * * *', label: 'Propostas vencidas', what: 'expira propostas e garantias não pagas' },
  { name: 'connect-payouts', path: '/api/cron/connect-payouts', schedule: '40 * * * *', label: 'Repasses pela Stripe', what: 'paga as linhas liberadas de quem conectou depois' },
  { name: 'market-indicators', path: '/api/cron/market-indicators', schedule: '5 * * * *', label: 'Indicadores do cabeçalho', what: 'dólar, euro e o índice da casa' },
  { name: 'instagram', path: '/api/cron/instagram', schedule: '50 */6 * * *', label: 'Instagram', what: 'posts agendados e tokens' },
  { name: 'deal-complete-retry', path: '/api/cron/deal-complete-retry', schedule: '25 * * * *', label: 'Escrituras pendentes', what: 'conclui a escritura de entrega confirmada que falhou' },
]

const H = 3_600_000, D = 24 * H
// The interval a 5-field cron implies: hourly (minute only), every N hours (hour field "star slash N"), daily (fixed hour). Unknown → a day.
export function intervalOfSchedule(schedule: string): number {
  const [, hour] = schedule.trim().split(/\s+/)
  if (hour === '*') return H
  const every = /^\*\/(\d+)$/.exec(hour ?? '')
  if (every) return Number(every[1]) * H
  return D
}

export type CronHealth = 'OK' | 'FAILING' | 'LATE' | 'RUNNING' | 'NEVER'
export const CRON_HEALTH_LABELS: Record<CronHealth, string> = { OK: 'Em dia', FAILING: 'Falhando', LATE: 'Atrasado', RUNNING: 'Rodando', NEVER: 'Sem registro' }

export interface RunRow { status: string; startedAt: string; finishedAt: string | null; ms: number | null; httpStatus: number | null; error: string | null; summary: string | null }

/** A RUNNING row older than this never finished: the function was killed (Vercel's maxDuration) before `finally` ran. */
export const STALE_RUNNING_MS = 15 * 60_000

/** Rows that say something about the job: SKIPPED only proves the lease worked and never counts as a run (it would hide a FAILED one). */
export function realRuns(runs: RunRow[], now: Date): RunRow[] {
  return runs
    .filter((r) => r.status !== 'SKIPPED')
    .map((r) => (r.status === 'RUNNING' && now.getTime() - new Date(r.startedAt).getTime() > STALE_RUNNING_MS ? { ...r, status: 'FAILED', error: r.error ?? 'timeout' } : r))
}

/** Late = no successful run within twice the interval (plus 15 min of slack for the platform's jitter). */
export function cronHealth(spec: Pick<CronSpec, 'schedule'>, runs: RunRow[], lease: { lockedUntil: string } | null, now: Date): CronHealth {
  const real = realRuns(runs, now)
  const last = real[0] ?? null
  if (last?.status === 'RUNNING' || (lease && new Date(lease.lockedUntil) > now)) return 'RUNNING'
  if (!last) return 'NEVER'
  const lastOk = real.find((r) => r.status === 'OK')
  const limit = 2 * intervalOfSchedule(spec.schedule) + 15 * 60_000
  if (!lastOk || now.getTime() - new Date(lastOk.startedAt).getTime() > limit) return last.status === 'FAILED' ? 'FAILING' : 'LATE'
  if (last.status === 'FAILED') return 'FAILING'
  return 'OK'
}

export interface CronView extends CronSpec {
  health: CronHealth; healthLabel: string; interval: number
  lastRun: RunRow | null; lastOk: RunRow | null; failures7d: number
  lease: { lockedUntil: string; runId: string } | null
  runs: RunRow[]
}

export interface WebhookView { type: string; last24h: number; last7d: number; lastAt: string | null }
export interface WebhookFailure { name: string; at: string; error: string | null }

/** Presence of each configuration the operation depends on: never the value. */
export interface ConfigItem { key: string; label: string; ok: boolean; note: string }

export function kpisOf(crons: CronView[], failures: WebhookFailure[], financeAlerts: number) {
  return {
    cronsOk: crons.filter((c) => c.health === 'OK' || c.health === 'RUNNING').length,
    cronsBad: crons.filter((c) => c.health === 'FAILING' || c.health === 'LATE').length,
    cronsNever: crons.filter((c) => c.health === 'NEVER').length,
    webhookFailures7d: failures.length,
    financeAlerts,
  }
}
