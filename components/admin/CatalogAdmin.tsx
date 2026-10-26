'use client'
// Admin › Catálogo: the plans (name, description, monthly price, active, limits) and the services
// (name, description, price, unit, active), one row each that opens to a form; admin and manager
// save through POST /api/admin/catalog (a deactivation asks first), the rest of the staff reads.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import { centsToInput, DESCRIPTION_MAX, NAME_MAX, SERVICE_UNIT_LABELS, SERVICE_UNITS, type AdminPlanRow, type AdminServiceRow, type ServiceUnit } from '@/lib/admin-catalog/core'

type PlanForm = { name: string; description: string; price: string; active: boolean; limits: Record<string, string> }
type ServiceForm = { name: string; description: string; price: string; unit: ServiceUnit; active: boolean }
type Pending = { kind: 'plan' | 'service'; id: number; label: string; body: Record<string, unknown>; deactivates: boolean }

const planForm = (p: AdminPlanRow): PlanForm => ({ name: p.name, description: p.description, price: centsToInput(p.priceCents), active: p.active, limits: Object.fromEntries(p.limits.map((l) => [l.key, l.limit === null ? '' : String(l.limit)])) })
const serviceForm = (s: AdminServiceRow): ServiceForm => ({ name: s.name, description: s.description, price: centsToInput(s.priceCents), unit: s.unit, active: s.active })
const money = (cents: string) => formatBRL(BigInt(cents))

export function CatalogAdmin({ plans: initialPlans, services: initialServices, edits }: { plans: AdminPlanRow[]; services: AdminServiceRow[]; edits: boolean }) {
  const [plans, setPlans] = useState(initialPlans)
  const [services, setServices] = useState(initialServices)
  const [open, setOpen] = useState<string | null>(null)
  const [planForms, setPlanForms] = useState<Record<number, PlanForm>>({})
  const [serviceForms, setServiceForms] = useState<Record<number, ServiceForm>>({})
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')

  const pf = (p: AdminPlanRow) => planForms[p.id] ?? planForm(p)
  const sf = (s: AdminServiceRow) => serviceForms[s.id] ?? serviceForm(s)

  async function send(p: Pending) {
    setBusy(true); setError((e) => ({ ...e, [`${p.kind}:${p.id}`]: '' }))
    const res = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: p.kind, id: p.id, ...p.body }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string; changed?: string[] } | undefined
    setBusy(false); setPending(null)
    if (!res?.ok) { setError((e) => ({ ...e, [`${p.kind}:${p.id}`]: data?.error ?? 'Não foi possível salvar.' })); return }
    if (p.kind === 'plan') {
      const f = p.body as unknown as { name: string; description: string; priceCents: number; active: boolean; limits: Record<string, number | null> }
      setPlans((xs) => xs.map((x) => x.id === p.id ? { ...x, name: f.name, description: f.description, priceCents: String(f.priceCents), active: f.active, limits: x.limits.map((l) => (l.key in f.limits ? { ...l, limit: f.limits[l.key] } : l)) } : x))
      setPlanForms((m) => { const n = { ...m }; delete n[p.id]; return n })
    } else {
      const f = p.body as unknown as { name: string; description: string; priceCents: number; unit: ServiceUnit; active: boolean }
      setServices((xs) => xs.map((x) => x.id === p.id ? { ...x, name: f.name, description: f.description, priceCents: String(f.priceCents), unit: f.unit, unitLabel: SERVICE_UNIT_LABELS[f.unit], active: f.active } : x))
      setServiceForms((m) => { const n = { ...m }; delete n[p.id]; return n })
    }
    setToast(data?.changed?.length ? `${p.label} · ${data.changed.length === 1 ? 'um campo alterado' : `${data.changed.length} campos alterados`}` : `${p.label} · nada mudou`)
  }

  /** Reais typed on the screen → integer cents; the server validates again. */
  const cents = (v: string): number | string => { const m = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(v); return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : v }

  function submitPlan(p: AdminPlanRow) {
    const f = pf(p)
    const limits: Record<string, number | null | string> = {}
    for (const l of p.limits) { const v = (f.limits[l.key] ?? '').trim(); limits[l.key] = v === '' ? null : /^\d+$/.test(v) ? Number(v) : v }
    const body = { name: f.name, description: f.description, priceCents: cents(f.price), active: f.active, limits }
    const next: Pending = { kind: 'plan', id: p.id, label: `Plano ${f.name}`, body, deactivates: p.active && !f.active }
    if (next.deactivates) setPending(next); else void send(next)
  }
  function submitService(s: AdminServiceRow) {
    const f = sf(s)
    const body = { name: f.name, description: f.description, priceCents: cents(f.price), unit: f.unit, active: f.active }
    const next: Pending = { kind: 'service', id: s.id, label: f.name, body, deactivates: s.active && !f.active }
    if (next.deactivates) setPending(next); else void send(next)
  }

  const toggle = (key: string) => setOpen((o) => (o === key ? null : key))

  return (
    <div className="ha-acat">
      <section className="ha-acat__section" aria-labelledby="acat-plans">
        <h2 id="acat-plans" className="ha-h3">Planos</h2>
        {plans.map((p) => {
          const key = `plan:${p.id}`; const isOpen = open === key; const f = pf(p)
          return (
            <div key={p.id} className={`ha-acat__row${p.active ? '' : ' ha-acat__row--off'}`}>
              <button type="button" className="ha-acat__head" aria-expanded={isOpen} onClick={() => toggle(key)}>
                <div className="ha-acat__who"><b>{p.name}</b><span className="ha-acat__sub">{p.audienceLabel} · {p.code}{p.isDefault ? ' · padrão do público' : ''}</span></div>
                <div className="ha-acat__facts"><span className="ha-acat__sub">{p.description || '—'}</span><span className="ha-acat__sub">{p.limits.map((l) => `${l.label}: ${l.limit === null ? 'ilimitado' : l.limit}`).join(' · ') || 'sem limites'}</span></div>
                <div className="ha-acat__price">{p.priceCents === '0' ? 'Grátis' : `${money(p.priceCents)}/mês`}</div>
                <div className="ha-acat__state"><Badge tone={p.active ? 'verified' : 'neutral'}>{p.active ? 'Ativo' : 'Desligado'}</Badge><span>{p.activeSubscriptions} {p.activeSubscriptions === 1 ? 'assinatura' : 'assinaturas'}</span></div>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
              </button>
              {isOpen ? (
                <div className="ha-acat__body">
                  <div className="ha-acat__grid">
                    <label className="ha-acat__field">Nome<input className="ha-input" value={f.name} maxLength={NAME_MAX} disabled={!edits} onChange={(e) => setPlanForms((m) => ({ ...m, [p.id]: { ...f, name: e.target.value } }))} /></label>
                    <label className="ha-acat__field">Mensalidade (R$)<input className="ha-input" inputMode="decimal" value={f.price} disabled={!edits} onChange={(e) => setPlanForms((m) => ({ ...m, [p.id]: { ...f, price: e.target.value } }))} /></label>
                    <label className="ha-acat__field ha-acat__grid--wide">Descrição (aparece nos cartões de preço do site)<textarea className="ha-textarea" rows={2} value={f.description} maxLength={DESCRIPTION_MAX} disabled={!edits} onChange={(e) => setPlanForms((m) => ({ ...m, [p.id]: { ...f, description: e.target.value } }))} /></label>
                  </div>
                  <div className="ha-acat__limits">
                    {p.limits.map((l) => (
                      <label key={l.key} className="ha-acat__limit">{l.label}<input className="ha-input" inputMode="numeric" placeholder="ilimitado" value={f.limits[l.key] ?? ''} disabled={!edits} onChange={(e) => setPlanForms((m) => ({ ...m, [p.id]: { ...f, limits: { ...f.limits, [l.key]: e.target.value } } }))} /></label>
                    ))}
                  </div>
                  <p className="ha-acat__note">Limite vazio = ilimitado; 0 = não incluído. Quem já assina segue com a mensalidade que paga; o preço novo vale para quem aderir daqui em diante.</p>
                  <div className="ha-acat__actions">
                    <label className="ha-acat__check"><input type="checkbox" checked={f.active} disabled={!edits || p.isDefault} onChange={(e) => setPlanForms((m) => ({ ...m, [p.id]: { ...f, active: e.target.checked } }))} /> Ativo (aparece no site e pode ser contratado)</label>
                    {edits ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => submitPlan(p)}>Salvar</button> : null}
                    {edits && planForms[p.id] ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => setPlanForms((m) => { const n = { ...m }; delete n[p.id]; return n })}>Desfazer</button> : null}
                  </div>
                  {error[key] ? <p className="ha-acat__err" role="alert">{error[key]}</p> : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </section>

      <section className="ha-acat__section" aria-labelledby="acat-services">
        <h2 id="acat-services" className="ha-h3">Serviços</h2>
        {services.map((s) => {
          const key = `service:${s.id}`; const isOpen = open === key; const f = sf(s)
          return (
            <div key={s.id} className={`ha-acat__row${s.active ? '' : ' ha-acat__row--off'}`}>
              <button type="button" className="ha-acat__head" aria-expanded={isOpen} onClick={() => toggle(key)}>
                <div className="ha-acat__who"><b>{s.name}</b><span className="ha-acat__sub">{s.code}</span></div>
                <div className="ha-acat__facts"><span className="ha-acat__sub">{s.description || '—'}</span>{s.note ? <span className="ha-acat__sub">{s.note}</span> : null}</div>
                <div className="ha-acat__price">{s.unit === 'QUOTE' || s.priceCents === '0' ? 'Sob orçamento' : `${money(s.priceCents)} ${s.unitLabel}`}</div>
                <div className="ha-acat__state"><Badge tone={s.active ? 'verified' : 'neutral'}>{s.active ? 'Ativo' : 'Desligado'}</Badge><span>{s.orders30d} {s.orders30d === 1 ? 'pedido' : 'pedidos'} em 30 d</span></div>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
              </button>
              {isOpen ? (
                <div className="ha-acat__body">
                  <div className="ha-acat__grid">
                    <label className="ha-acat__field">Nome<input className="ha-input" value={f.name} maxLength={NAME_MAX} disabled={!edits} onChange={(e) => setServiceForms((m) => ({ ...m, [s.id]: { ...f, name: e.target.value } }))} /></label>
                    <label className="ha-acat__field">Preço (R$)<input className="ha-input" inputMode="decimal" value={f.price} disabled={!edits} onChange={(e) => setServiceForms((m) => ({ ...m, [s.id]: { ...f, price: e.target.value } }))} /></label>
                    <label className="ha-acat__field">Unidade<select className="ha-select" value={f.unit} disabled={!edits} onChange={(e) => setServiceForms((m) => ({ ...m, [s.id]: { ...f, unit: e.target.value as ServiceUnit } }))}>{SERVICE_UNITS.map((u) => <option key={u} value={u}>{SERVICE_UNIT_LABELS[u]}</option>)}</select></label>
                    <label className="ha-acat__field ha-acat__grid--wide">Descrição<textarea className="ha-textarea" rows={2} value={f.description} maxLength={DESCRIPTION_MAX} disabled={!edits} onChange={(e) => setServiceForms((m) => ({ ...m, [s.id]: { ...f, description: e.target.value } }))} /></label>
                  </div>
                  {s.note ? <p className="ha-acat__note">{s.note}</p> : null}
                  <div className="ha-acat__actions">
                    <label className="ha-acat__check"><input type="checkbox" checked={f.active} disabled={!edits} onChange={(e) => setServiceForms((m) => ({ ...m, [s.id]: { ...f, active: e.target.checked } }))} /> Ativo (pode ser pedido)</label>
                    {edits ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => submitService(s)}>Salvar</button> : null}
                    {edits && serviceForms[s.id] ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => setServiceForms((m) => { const n = { ...m }; delete n[s.id]; return n })}>Desfazer</button> : null}
                  </div>
                  {error[key] ? <p className="ha-acat__err" role="alert">{error[key]}</p> : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </section>

      <Modal open={!!pending} title="Desligar?" onClose={() => (busy ? null : setPending(null))} footer={<>
        <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" disabled={busy} onClick={() => setPending(null)}>Cancelar</button>
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => pending && void send(pending)}>{busy ? 'Salvando…' : 'Desligar e salvar'}</button>
      </>}>
        {pending ? <p>{pending.kind === 'plan' ? `${pending.label} sai do site e deixa de ser contratado. Quem já assina continua como está.` : `${pending.label} deixa de ser pedido: toda tela que o oferece passa a recusar o pedido até ele ser religado. Pedidos pagos ficam como estão.`}</p> : null}
      </Modal>
      {toast ? <Toast message={toast} onDone={() => setToast('')} /> : null}
    </div>
  )
}
