// Admin › Saúde operacional — I/O: each cron with its trail (JobRun) and lease, the Stripe
// webhooks processed and the deliveries that failed, the finance alerts the audit trail holds
// (refunds that did not go through, transfers without a record), and the PRESENCE of each
// configuration the operation needs — never a value.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { stripeMode } from '@/lib/stripe/door'
import { declaredPublicUrl } from '@/lib/public-url'
import { CRON_HEALTH_LABELS, cronHealth, CRONS, intervalOfSchedule, kpisOf, type ConfigItem, type CronView, type RunRow, type WebhookFailure, type WebhookView } from './core'

const RUNS_PER_CRON = 12
const DAY = 86_400_000

export interface FinanceAlert { entity: string; entityId: string; action: string; label: string; at: string; href: string }

const ALERT_LABELS: Record<string, string> = {
  escrow_stray_refund_failed: 'Pix/boleto pago sem negócio e sem estorno',
  transfer_unrecorded: 'repasse feito na Stripe sem registro aqui',
  cancel: 'cancelamento com estorno pendente',
}

export async function adminOps(now = new Date()) {
  return totalScope('admin:ops', async () => {
    const since7d = new Date(now.getTime() - 7 * DAY), since24h = new Date(now.getTime() - DAY), since30d = new Date(now.getTime() - 30 * DAY)
    const [runs, leases, events7d, failures, alertRows] = await Promise.all([
      prisma.jobRun.findMany({ where: { kind: 'CRON', startedAt: { gte: since30d } }, orderBy: { startedAt: 'desc' }, take: 1000 }),
      prisma.jobLease.findMany(),
      prisma.stripeEvent.findMany({ where: { processedAt: { gte: since7d } }, select: { type: true, processedAt: true } }),
      prisma.jobRun.findMany({ where: { kind: 'WEBHOOK', startedAt: { gte: since7d } }, orderBy: { startedAt: 'desc' }, take: 50, select: { name: true, startedAt: true, error: true } }),
      prisma.auditLog.findMany({ where: { createdAt: { gte: since30d }, OR: [{ action: { in: ['escrow_stray_refund_failed', 'transfer_unrecorded'] } }, { action: 'cancel', entity: { in: ['appraisal_request', 'ownership_transfer'] }, after: { contains: '"refundPending":true' } }] }, orderBy: { createdAt: 'desc' }, take: 50, select: { entity: true, entityId: true, action: true, createdAt: true } }),
    ])
    const toRow = (r: (typeof runs)[number]): RunRow => ({ status: r.status, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null, ms: r.ms, httpStatus: r.httpStatus, error: r.error, summary: r.summary })
    const leaseOf = new Map(leases.map((l) => [l.name, { lockedUntil: l.lockedUntil.toISOString(), runId: l.runId }]))
    const crons: CronView[] = CRONS.map((spec) => {
      const mine = runs.filter((r) => r.name === spec.name).map(toRow)
      const lease = leaseOf.get(spec.name) ?? null
      const health = cronHealth(spec, mine, lease, now)
      return { ...spec, health, healthLabel: CRON_HEALTH_LABELS[health], interval: intervalOfSchedule(spec.schedule), lastRun: mine[0] ?? null, lastOk: mine.find((r) => r.status === 'OK') ?? null, failures7d: mine.filter((r) => r.status === 'FAILED' && new Date(r.startedAt) >= since7d).length, lease, runs: mine.slice(0, RUNS_PER_CRON) }
    })
    const byType = new Map<string, WebhookView>()
    for (const e of events7d) {
      const v = byType.get(e.type) ?? { type: e.type, last24h: 0, last7d: 0, lastAt: null }
      v.last7d += 1; if (e.processedAt >= since24h) v.last24h += 1
      if (!v.lastAt || e.processedAt.toISOString() > v.lastAt) v.lastAt = e.processedAt.toISOString()
      byType.set(e.type, v)
    }
    const webhooks = [...byType.values()].sort((a, b) => b.last7d - a.last7d)
    const webhookFailures: WebhookFailure[] = failures.map((f) => ({ name: f.name, at: f.startedAt.toISOString(), error: f.error }))
    const financeAlerts: FinanceAlert[] = alertRows.map((a) => ({ entity: a.entity, entityId: a.entityId, action: a.action, label: ALERT_LABELS[a.action] ?? a.action, at: a.createdAt.toISOString(), href: `/admin/audit?entity=${encodeURIComponent(a.entity)}&id=${encodeURIComponent(a.entityId)}` }))
    // presence only, each name read literally (lib/architecture/env.test.ts counts computed reads)
    const set = (v: string | undefined) => !!(v ?? '').trim()
    const kyc = process.env.KYC_PROVIDER ?? 'mock', vendor = process.env.MARKER_VENDOR ?? 'mock'
    const config: ConfigItem[] = [
      { key: 'CRON_SECRET', label: 'Segredo dos crons', ok: set(process.env.CRON_SECRET), note: 'sem ele a Vercel não roda os crons em produção' },
      { key: 'STRIPE', label: 'Stripe', ok: stripeMode() !== 'mock', note: `modo ${stripeMode()}` },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook da Stripe', ok: set(process.env.STRIPE_WEBHOOK_SECRET), note: 'pagamentos e garantias' },
      { key: 'STRIPE_CONNECT_WEBHOOK_SECRET', label: 'Webhook das contas conectadas', ok: set(process.env.STRIPE_CONNECT_WEBHOOK_SECRET), note: 'repasses (Connect)' },
      { key: 'SMTP_URL', label: 'E-mail (SMTP)', ok: set(process.env.SMTP_URL), note: 'códigos de acesso, convites, avisos' },
      { key: 'WEB_PUSH', label: 'Push', ok: set(process.env.WEB_PUSH_VAPID_PUBLIC_KEY) && set(process.env.WEB_PUSH_VAPID_PRIVATE_KEY), note: 'avisos no aparelho' },
      { key: 'KYC_PROVIDER', label: 'KYC', ok: kyc !== 'mock', note: `provedor ${kyc}` },
      { key: 'MARKER_VENDOR', label: 'Etiquetas NFC', ok: vendor !== 'mock', note: `fornecedor ${vendor}` },
      { key: 'APP_URL', label: 'Endereço público', ok: declaredPublicUrl() !== null, note: 'links de e-mail e convites' },
      { key: 'ANTHROPIC_API_KEY', label: 'Leitura assistida (IA)', ok: set(process.env.ANTHROPIC_API_KEY), note: 'ficha a partir das fotos' },
    ]
    return { crons, webhooks, webhookFailures, financeAlerts, config, kpis: kpisOf(crons, webhookFailures, financeAlerts.length), generatedAt: now.toISOString() }
  })
}
