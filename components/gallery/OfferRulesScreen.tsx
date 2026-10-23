'use client'
// Regras de ofertas (handoff "HouseArt App Galeria" › Negócios › Regras, `rgItens`).
// Each item is a toggle; the first and the third open chips. Every change is a
// partial PUT /api/gallery/rules and a toast; the server's answer is the state.
import { useCallback, useState } from 'react'
import { Toggle } from '@/components/ds/Toggle'
import { Toast } from '@/components/ds/Toast'
import { REFUSE_BELOW_OPTIONS, RESPONSE_HOURS_OPTIONS, type OfferRulesView } from '@/lib/offers/rules-core'

const pct = (bps: number) => `${Math.round(bps / 100)}%`

/** `readOnly` (the gallery team without the Admin role): the rules are shown, nothing changes. */
export function OfferRulesScreen({ rules: initial, readOnly = false }: { rules: OfferRulesView; readOnly?: boolean }) {
  const [rules, setRules] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  async function save(patch: Partial<OfferRulesView>, done: string) {
    if (readOnly) return
    const before = rules
    setRules({ ...rules, ...patch })
    setBusy(true)
    const res = await fetch('/api/gallery/rules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    const data = await res.json().catch(() => ({})) as { rules?: OfferRulesView; error?: string }
    setBusy(false)
    if (!res.ok || !data.rules) { setRules(before); setToast(data.error ?? 'Não foi possível salvar a regra.'); return }
    setRules(data.rules)
    setToast(done)
  }

  const items: { key: string; name: string; sub: string; on: boolean; locked?: boolean; toggle?: () => void; ops?: { label: string; on: boolean; go: () => void }[] }[] = [
    {
      key: 'refuse', name: 'Recusar ofertas baixas', sub: `Abaixo de ${pct(rules.refuseBelowBps)} do preço, recusamos com uma mensagem gentil`, on: rules.refuseLow,
      toggle: () => save({ refuseLow: !rules.refuseLow }, rules.refuseLow ? 'Ofertas baixas passam a chegar para você responder' : `Ofertas abaixo de ${pct(rules.refuseBelowBps)} são recusadas automaticamente`),
      ops: rules.refuseLow ? REFUSE_BELOW_OPTIONS.map((bps) => ({ label: pct(bps), on: rules.refuseBelowBps === bps, go: () => save({ refuseBelowBps: bps }, `Mínimo para recusar: ${pct(bps)} do preço`) })) : undefined,
    },
    {
      key: 'auto', name: 'Aceitar automaticamente', sub: `Ofertas a partir de ${pct(rules.autoAcceptMinBps)} do preço são aceitas na hora`, on: rules.autoAcceptOn,
      toggle: () => save({ autoAcceptOn: !rules.autoAcceptOn }, rules.autoAcceptOn ? 'Nenhuma oferta é aceita sem você' : `Ofertas a partir de ${pct(rules.autoAcceptMinBps)} do preço são aceitas na hora`),
    },
    {
      key: 'hours', name: 'Prazo para responder', sub: 'Depois disso, a oferta expira e o comprador é avisado', on: true, locked: true,
      ops: RESPONSE_HOURS_OPTIONS.map((h) => ({ label: `${h} h`, on: rules.responseHours === h, go: () => save({ responseHours: h }, `Prazo para responder: ${h} h`) })),
    },
    {
      key: 'team', name: 'Avisar a equipe de vendas', sub: 'Quem tem o papel Vendas recebe as ofertas junto com você', on: rules.notifyTeam,
      toggle: () => save({ notifyTeam: !rules.notifyTeam }, rules.notifyTeam ? 'Só você recebe as ofertas' : 'A equipe de vendas recebe as ofertas junto com você'),
    },
  ]

  return (
    <div className="ha-rules">
      <p className="ha-rules__intro">Regras valem para todas as obras que aceitam ofertas. Você pode mudar obra a obra na página dela.</p>
      {items.map((it) => (
        <section key={it.key} className="ha-rules-item" aria-labelledby={`rule-${it.key}`}>
          <div className="ha-rules-item__row">
            <span className="ha-stack">
              <span id={`rule-${it.key}`} className="ha-rules-item__n">{it.name}</span>
              <span className="ha-rules-item__s">{it.sub}</span>
            </span>
            <Toggle on={it.on} disabled={busy || it.locked || readOnly} label={it.name} onChange={() => it.toggle?.()} />
          </div>
          {it.ops ? (
            <div className="ha-rules-item__ops" role="radiogroup" aria-label={it.name}>
              {it.ops.map((o) => (
                <button key={o.label} type="button" role="radio" aria-checked={o.on} disabled={busy || readOnly} className={`ha-chip${o.on ? ' ha-chip--on' : ''}`} onClick={o.go}>{o.label}</button>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
