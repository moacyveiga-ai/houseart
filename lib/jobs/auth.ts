// Authorization of job/cron routes (/api/jobs/*, /api/cron/*) — single door,
// ported: Bearer CRON_SECRET first (no I/O), manual POST by admin/manager,
// dev without secret only outside production. `withJob` runs the handler in
// TOTAL scope under a JobLease.
import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { totalScope } from '@/lib/scope/context'
import { leaseMs, skippedBody } from '@/lib/job-lease/core'
import { acquireJobLease, releaseJobLease } from '@/lib/job-lease/server'
import { finishJobRun, startJobRun } from '@/lib/job-runs/server'
import { acessoLiberado as accessAllowed, bearerValido as validBearer } from './auth-core'

export type ManualJobRule = 'staff' | 'admin'
export interface JobOptions { manual?: ManualJobRule; leaseMs?: number }

async function manualAuthorized(rule: ManualJobRule): Promise<boolean> {
  try {
    const u = await requireAuth()
    return rule === 'admin' ? u.profile === 'admin' : u.profile === 'admin' || u.profile === 'manager'
  } catch { return false }
}

export async function authorizeJob(req: NextRequest, manual: ManualJobRule = 'staff'): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  const authorization = req.headers.get('authorization')
  if (validBearer(secret, authorization)) return true
  const method = req.method.toUpperCase()
  return accessAllowed({
    secret, authorization, metodo: method,
    staff: method !== 'GET' && method !== 'HEAD' ? await manualAuthorized(manual) : false,
    producao: process.env.NODE_ENV === 'production',
  })
}

export function unauthorizedJob(): NextResponse {
  const noSecret = !process.env.CRON_SECRET && process.env.NODE_ENV === 'production'
  return NextResponse.json({ error: 'Não autorizado', ...(noSecret ? { reason: 'CRON_SECRET não está configurada neste ambiente' } : {}) }, { status: 401 })
}

export async function withJob(req: NextRequest, name: string, handler: () => Promise<Response>, opts?: JobOptions): Promise<Response> {
  if (!(await authorizeJob(req, opts?.manual))) return unauthorizedJob()
  const t0 = Date.now()
  let status = 500
  let skipped = false
  let runId: string | null = null
  let trail: number | null = null
  let summary: string | null = null
  let errorName: string | null = null
  try {
    runId = await acquireJobLease(name, leaseMs(opts?.leaseMs))
    trail = await startJobRun('CRON', name, runId)
    if (!runId) { skipped = true; status = 200; return NextResponse.json(skippedBody(name)) }
    const res = await totalScope(`job:${name}`, handler)
    status = res.status
    summary = await res.clone().text().catch(() => null)
    return res
  } catch (err) {
    errorName = err instanceof Error ? err.name : 'unknown'
    const { reportServerError } = await import('@/lib/observability/report')
    await reportServerError(err, { job: name, method: req.method, path: req.nextUrl.pathname })
    return NextResponse.json({ ok: false, job: name, error: 'Falha inesperada no job (registrada no log).' }, { status: 500 })
  } finally {
    if (runId) { try { await releaseJobLease(name, runId) } catch (err) { console.warn(JSON.stringify({ level: 'warn', evt: 'job_lease_release_failed', job: name, error: err instanceof Error ? err.message : String(err) })) } }
    const ms = Date.now() - t0
    await finishJobRun(trail, { status: skipped ? 'SKIPPED' : status >= 500 ? 'FAILED' : 'OK', httpStatus: status, ms, error: errorName, summary })
    console.info(JSON.stringify({ level: status >= 500 ? 'error' : 'info', evt: 'job_run', job: name, status, ms, ...(skipped ? { skipped: true } : {}) }))
  }
}
