'use client'
// "Serviços para uma obra" (handoff "HouseArt App Colecionador" › Serviços para uma obra, step
// `cbP4` of `CB_SERV`): the catalog services a collector can order for ONE artwork, multi-select,
// price or "Sob orçamento" (the catalog has no deadlines: none is shown). Certification comes
// first and reads "Necessária para vender" while the artwork has no green seal. Confirm →
// POST /api/collector/artworks/<id>/services per service → the caller's toast.
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import { SERVICE_ICONS, orderServices, servicePriceLabel } from './seller-core'
import './collector-sheets.css'

export interface ServiceItem { code: string; name: string; description: string; priceCents: string; unit: string }

export function ServicesSheet({ artworkId, title, sealGreen, open, onClose, onDone }: { artworkId: number; title: string; sealGreen: boolean; open: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [items, setItems] = useState<ServiceItem[] | null>(null)
  // The sheet is mounted when it opens (the wallet keys it by artwork and open), so the initial selection is enough.
  const [sel, setSel] = useState<Record<string, boolean>>((): Record<string, boolean> => (sealGreen ? {} : { CERTIFICATION: true }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => {
    if (!open) return
    let gone = false
    fetch('/api/collector/services').then(async (r) => {
      const d = (await r.json().catch(() => ({}))) as { items?: ServiceItem[]; error?: string }
      if (gone) return
      if (!r.ok || !d.items) { setError(d.error ?? 'Não foi possível carregar os serviços.'); setItems([]); return }
      setItems(orderServices(d.items))
    }).catch(() => { if (!gone) { setError('Não foi possível carregar os serviços.'); setItems([]) } })
    return () => { gone = true }
  }, [open])
  if (!open) return null

  const chosen = (items ?? []).filter((s) => sel[s.code])
  const total = chosen.reduce((t, s) => (s.unit === 'QUOTE' ? t : t + (/^\d+$/.test(s.priceCents) ? BigInt(s.priceCents) : 0n)), 0n)
  const quotes = chosen.filter((s) => s.unit === 'QUOTE' || s.priceCents === '0').length

  async function confirm() {
    setBusy(true); setError('')
    const made: string[] = []
    let quoted = 0
    for (const s of chosen) {
      const res = await fetch(`/api/collector/artworks/${artworkId}/services`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: s.code }) })
      const d = (await res.json().catch(() => ({}))) as { code?: string; quote?: boolean; error?: string }
      if (!res.ok) { setBusy(false); setError(d.error ?? 'Não foi possível pedir o serviço.'); if (made.length || quoted) onDone(summary(made, quoted)); return }
      if (d.quote) quoted += 1; else if (d.code) made.push(d.code)
    }
    setBusy(false)
    onDone(summary(made, quoted))
    onClose()
  }
  const summary = (made: string[], quoted: number) => [made.length ? `Pedido ${made.join(', ')} criado` : '', quoted ? (quoted === 1 ? 'Pedido de orçamento enviado · a equipe entra em contato' : `${quoted} pedidos de orçamento enviados · a equipe entra em contato`) : ''].filter(Boolean).join(' · ')

  return (
    <div className="ha-scrim ha-cs-scrim" onClick={onClose} role="presentation">
      <div className="ha-cs" role="dialog" aria-modal="true" aria-label="Serviços para esta obra" onClick={(e) => e.stopPropagation()}>
        <div className="ha-cs__grip"><span /></div>
        <div className="ha-cs__head">
          <span className="ha-cs__head-t"><span className="ha-cs__title">Serviços para esta obra</span><span className="ha-cs__step">{title}</span></span>
          <button type="button" className="ha-iconbtn ha-cs__x" onClick={onClose} aria-label="Fechar"><Icon name="close" size={24} /></button>
        </div>
        <div className="ha-cs__body">
          <span className="ha-cs__lead">Escolha o que precisa agora. Dá para pedir os outros depois.</span>
          {items === null ? <span className="ha-muted ha-sm">Carregando…</span> : null}
          {items?.map((s) => {
            const on = !!sel[s.code]
            const need = s.code === 'CERTIFICATION' && !sealGreen
            return (
              <div key={s.code} className={`ha-cs__svc${on ? ' ha-cs__svc--on' : ''}`}>
                <button type="button" className="ha-cs__svc-btn" role="checkbox" aria-checked={on} onClick={() => setSel({ ...sel, [s.code]: !on })}>
                  <span className="ha-cs__svc-i"><Icon name={SERVICE_ICONS[s.code] ?? 'home_repair_service'} size={20} /></span>
                  <span className="ha-cs__svc-txt">
                    <span className="ha-cs__svc-n">{s.name}{need ? <span className="ha-cs__svc-tag ha-cs__svc-tag--need">Necessária para vender</span> : null}</span>
                    {s.description ? <span className="ha-cs__svc-d">{s.description}</span> : null}
                    <span className="ha-cs__svc-p">{servicePriceLabel(s, formatBRL)}</span>
                  </span>
                  <span className="ha-cs__svc-check"><Icon name={on ? 'check_box' : 'check_box_outline_blank'} size={22} filled={on} /></span>
                </button>
              </div>
            )
          })}
          {error ? <span className="ha-cs__err" role="alert">{error}</span> : null}
        </div>
        <div className="ha-cs__foot">
          {chosen.length ? <span className="ha-cs__total"><span>{chosen.length === 1 ? '1 serviço' : `${chosen.length} serviços`}{quotes ? ` · ${quotes} sob orçamento` : ''}</span><b>{total > 0n ? formatBRL(total) : 'Sem cobrança agora'}</b></span> : null}
          <button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-cs__cta" disabled={busy || chosen.length === 0} onClick={confirm} aria-busy={busy || undefined}>{busy ? 'Enviando…' : chosen.length > 1 ? `Pedir ${chosen.length} serviços` : 'Pedir serviço'}</button>
        </div>
      </div>
    </div>
  )
}
