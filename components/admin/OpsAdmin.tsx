'use client'
// Admin › Saúde operacional: each cron with its health and trail (and "Rodar agora", a manual POST
// to the cron route — admin and manager, the route's own rule), the Stripe webhooks processed and
// the deliveries that failed, the finance alerts (links to the audit trail) and the configuration
// present. Nothing here shows a secret: only whether it exists.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Toast } from '@/components/ds/Toast'
import { dataBR } from '@/lib/timezone'
import type { CronHealth, CronView, RunRow } from '@/lib/admin-ops/core'
import type { adminOps } from '@/lib/admin-ops/server'

type View = Awaited<ReturnType<typeof adminOps>>
const HEALTH_TONE: Record<CronHealth, BadgeTone> = { OK: 'verified', RUNNING: 'ink', LATE: 'pending', FAILING: 'alert', NEVER: 'neutral' }
const RUN_TONE: Record<string, BadgeTone> = { OK: 'verified', SKIPPED: 'neutral', FAILED: 'alert', RUNNING: 'ink' }
const RUN_LABEL: Record<string, string> = { OK: 'ok', SKIPPED: 'pulou (já rodava)', FAILED: 'falhou', RUNNING: 'rodando' }
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const every = (ms: number) => (ms >= 86_400_000 ? 'diário' : ms === 3_600_000 ? 'a cada hora' : `a cada ${Math.round(ms / 3_600_000)} h`)

export function OpsAdmin({ view, canRun }: { view: View; canRun: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [results, setResults] = useState<Record<string, string>>({})

  async function run(c: CronView) {
    setBusy(c.name)
    const res = await fetch(c.path, { method: 'POST' }).catch(() => null)
    const text = (await res?.text().catch(() => '')) ?? ''
    setBusy(null)
    setResults((m) => ({ ...m, [c.name]: `${res?.status ?? 'sem resposta'} · ${text.slice(0, 300)}` }))
    setToast(res?.ok ? `${c.label}: rodou (${res.status})` : `${c.label}: ${res?.status ?? 'sem resposta'}`)
  }

  return (
    <div className="ha-aops">
      <section className="ha-aops__section">
        <h2 className="ha-h2">Crons</h2>
        <p className="ha-muted ha-sm">As 12 rodadas mais recentes de cada rotina (a trilha guarda 90 dias). Atrasado = sem rodada boa em duas vezes o intervalo; uma rodada parada há mais de 15 min conta como falha (a função foi abatida pelo tempo máximo); a Vercel só dispara os crons em produção.</p>
        <div className="ha-aops__list">
          {view.crons.map((c) => {
            const isOpen = open === c.name
            return (
              <article key={c.name} className="ha-aops__row">
                <button type="button" className="ha-aops__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.name)}>
                  <span className="ha-aops__who"><b>{c.label}</b><span className="ha-aops__sub">{c.what} · {every(c.interval)} · <code>{c.schedule}</code></span></span>
                  <span className="ha-aops__facts"><span>{c.lastRun ? `última ${when(c.lastRun.startedAt)} · ${RUN_LABEL[c.lastRun.status] ?? c.lastRun.status}${c.lastRun.ms !== null ? ` · ${c.lastRun.ms} ms` : ''}` : 'nunca rodou'}</span><span className="ha-aops__sub">{c.lastOk ? `última boa ${when(c.lastOk.startedAt)}` : 'nenhuma rodada boa'}{c.failures7d ? ` · ${c.failures7d} ${c.failures7d === 1 ? 'falha' : 'falhas'} em 7 dias` : ''}</span></span>
                  <span className="ha-aops__state"><Badge tone={HEALTH_TONE[c.health]}>{c.healthLabel}</Badge>{c.lease && new Date(c.lease.lockedUntil) > new Date() ? <span className="ha-aops__flag ha-aops__flag--soft"><Icon name="lock" /> trava até {when(c.lease.lockedUntil)}</span> : null}</span>
                  <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
                </button>
                {isOpen ? (
                  <div className="ha-aops__body">
                    {c.runs.length === 0 ? <p className="ha-muted ha-sm">Sem rodada registrada ainda (a trilha começou com esta tela).</p> : (
                      <ul className="ha-aops__runs">
                        {c.runs.map((r: RunRow, i) => <li key={i}><Badge tone={RUN_TONE[r.status] ?? 'neutral'}>{RUN_LABEL[r.status] ?? r.status}</Badge><span>{when(r.startedAt)}</span><span className="ha-aops__sub">{r.ms !== null ? `${r.ms} ms` : ''}{r.httpStatus ? ` · ${r.httpStatus}` : ''}{r.error ? ` · ${r.error}` : ''}{r.by ? ` · à mão por ${r.by}` : ''}</span><span className="ha-aops__summary">{r.summary ?? ''}</span></li>)}
                      </ul>
                    )}
                    {canRun ? <div className="ha-aops__actions"><button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" disabled={busy === c.name} onClick={() => run(c)}>{busy === c.name ? 'Rodando…' : 'Rodar agora'}</button>{results[c.name] ? <code className="ha-aops__result">{results[c.name]}</code> : null}</div> : <p className="ha-muted ha-sm">Só admin e gestor disparam uma rodada à mão.</p>}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="ha-aops__section">
        <h2 className="ha-h2">Webhooks da Stripe</h2>
        {view.webhooks.length === 0 ? <p className="ha-muted ha-sm">Nenhum evento processado nos últimos 7 dias.</p> : (
          <ul className="ha-aops__runs">
            {view.webhooks.map((w) => <li key={w.type}><code>{w.type}</code><span>{w.last24h} em 24 h · {w.last7d} em 7 dias</span><span className="ha-aops__sub">{w.lastAt ? `último ${when(w.lastAt)}` : ''}</span><span /></li>)}
          </ul>
        )}
        {view.webhookFailures.length ? (
          <>
            <h3 className="ha-h3">Entregas que falharam (a Stripe reenvia)</h3>
            <ul className="ha-aops__runs">
              {view.webhookFailures.map((f, i) => <li key={i}><Badge tone="alert">{f.error === 'bad_signature' ? 'recusada' : 'falhou'}</Badge><code>{f.name}</code><span className="ha-aops__sub">{when(f.at)}{f.error === 'bad_signature' ? ' · assinatura não confere (confira o segredo do webhook na Stripe)' : f.error ? ` · ${f.error}` : ''}</span><span /></li>)}
            </ul>
          </>
        ) : null}
      </section>

      <section className="ha-aops__section">
        <h2 className="ha-h2">Alertas do financeiro</h2>
        {view.financeAlerts.length === 0 ? <p className="ha-muted ha-sm">Nenhum estorno pendente (laudo cancelado) nem repasse sem registro nos últimos 30 dias.</p> : (
          <ul className="ha-aops__runs">
            {view.financeAlerts.map((a, i) => <li key={i}><Badge tone="alert">atenção</Badge><span>{a.label}</span><span className="ha-aops__sub">{a.entity} #{a.entityId} · {dataBR(a.at)}</span><Link href={a.href} className="ha-link">ver na auditoria</Link></li>)}
          </ul>
        )}
      </section>

      <section className="ha-aops__section">
        <h2 className="ha-h2">Configuração presente</h2>
        <ul className="ha-aops__config">
          {view.config.map((c) => <li key={c.key}><Icon name={c.ok ? 'check_circle' : 'radio_button_unchecked'} /><b>{c.label}</b><span className="ha-aops__sub">{c.note}</span></li>)}
        </ul>
        <p className="ha-muted ha-sm">Gerado em {when(view.generatedAt)} · só a presença de cada configuração, nunca o valor.</p>
      </section>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
