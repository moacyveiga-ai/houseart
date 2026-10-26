'use client'
// The artwork in the collector's side panel (handoff "HouseArt Web Colecionador" › obra): header
// with share · save · like, the viewer (Frente / Detalhe / Verso, tap to zoom on the point), artist ›,
// italic title and ficha, the price block with the likes, the certificate card, the provenance,
// the seller with "Conversar" and the guarantees; the footer is "Fazer oferta" + "Comprar agora" on
// the market, or the owner's "Serviços" + "Vender esta obra" (the deed actions just above it).
import Link from 'next/link'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { SidePanel } from '@/components/ds/SidePanel'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { SellSheet } from './SellSheet'
import { ServicesSheet } from './ServicesSheet'
import { CommentsSheet } from '@/components/community/CommentsSheet'
import { Modal } from '@/components/ds/Modal'
import { RESTORATION_DESCRIPTION_MAX, RESTORATION_DESCRIPTION_MIN } from '@/lib/collector-wallet/restore-core'
import type { CollectorPanelData } from '@/lib/collector-wallet/panel-core'
import './collector-panel.css'
import '@/components/sales/sales-progress.css'

/** Today's day as the browser sees it: only the `max` of the date field (the server is the rule, in the house timezone). */
const todayIso = () => new Date().toISOString().slice(0, 10)

export function CollectorArtworkPanel({ a, closeHref, meInitials }: { a: CollectorPanelData; closeHref: string; meInitials: string }) {
  const router = useRouter()
  const [photo, setPhoto] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const [sig, setSig] = useState(a.signals)
  const [sheet, setSheet] = useState<'sell' | 'services' | 'comments' | 'restore' | null>(null)
  const [restore, setRestore] = useState({ description: '', restorer: '', on: '' })
  const [restoreError, setRestoreError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const cur = a.images[photo] ?? null
  const o = a.owner

  async function react(kind: 'LIKE' | 'SAVE') {
    if (!sig) return
    const prev = sig
    setSig(kind === 'LIKE' ? { ...sig, liked: !sig.liked, likes: sig.likes + (sig.liked ? -1 : 1) } : { ...sig, saved: !sig.saved })
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'ARTWORK', targetId: a.id, kind }) })
    const data = await res.json().catch(() => ({})) as { on?: boolean; count?: number }
    if (!res.ok) { setSig(prev); setToast('Não foi possível registrar.'); return }
    if (kind === 'LIKE' && typeof data.count === 'number') setSig((s) => (s ? { ...s, liked: !!data.on, likes: data.count! } : s))
    if (kind === 'SAVE') { setSig((s) => (s ? { ...s, saved: !!data.on } : s)); setToast(data.on ? 'Salva nos seus favoritos' : 'Removida dos favoritos') }
  }
  async function share() {
    if (!a.publicId) return
    const url = `${window.location.origin}/e/artwork/${a.publicId}`
    try {
      if (navigator.share) await navigator.share({ title: a.title, url })
      else { await navigator.clipboard.writeText(url); setToast('Link copiado') }
    } catch { /* closed by the person */ }
  }
  async function talk() {
    setBusy(true)
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: a.id }) })
    const data = await res.json().catch(() => ({})) as { id?: number; error?: string }
    setBusy(false)
    if (!res.ok || !data.id) { setToast(data.error ?? 'Não foi possível abrir a conversa.'); return }
    router.push(`/messages/${data.id}`)
  }
  async function post(path: string, body: unknown, ok: (d: Record<string, string>) => string) {
    setBusy(true)
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as Record<string, string>
    setBusy(false)
    setToast(res.ok ? ok(data) : data.error ?? 'Não foi possível registrar.')
    if (res.ok) router.refresh()
  }

  async function submitRestoration() {
    setRestoreError('')
    setBusy(true)
    const res = await fetch(`/api/wallet/${a.id}/restore`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: restore.description, restorer: restore.restorer, on: restore.on }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setRestoreError(data.error ?? 'Não foi possível registrar.'); return }
    setSheet(null); setRestore({ description: '', restorer: '', on: '' })
    setToast('Restauro registrado na proveniência da obra')
    router.refresh()
  }

  const actions = (
    <>
      {a.publicId ? <button type="button" className="ha-sidepanel__back" aria-label="Compartilhar" onClick={share}><Icon name="ios_share" size={24} /></button> : null}
      {sig ? <button type="button" className={`ha-sidepanel__back${sig.saved ? ' ha-cp__on' : ''}`} aria-label={sig.saved ? 'Remover dos favoritos' : 'Salvar'} aria-pressed={sig.saved} onClick={() => react('SAVE')}><Icon name="bookmark" size={24} filled={sig.saved} /></button> : null}
      {sig ? <button type="button" className={`ha-sidepanel__back${sig.liked ? ' ha-cp__liked' : ''}`} aria-label={sig.liked ? 'Descurtir' : 'Curtir'} aria-pressed={sig.liked} onClick={() => react('LIKE')}><Icon name="favorite" size={24} filled={sig.liked} /></button> : null}
    </>
  )
  const hasFooter = !!((a.market && (a.market.buyable || a.market.acceptsOffers) && a.publicId) || a.market?.reserved || o)
  const footer = !hasFooter ? undefined : (
    <div className="ha-cp__foot">
      {a.market && (a.market.buyable || a.market.acceptsOffers) && a.publicId ? (
        <>
          {a.market.acceptsOffers ? <Link href={`/e/artwork/${a.publicId}/offer`} className="ha-sd__btn">Fazer oferta</Link> : null}
          {a.market.buyable ? <Link href={`/e/artwork/${a.publicId}/buy`} className="ha-sd__btn ha-sd__btn--primary">Comprar agora</Link> : null}
        </>
      ) : null}
      {a.market?.reserved ? <span className="ha-cp__state">Reservada · em negociação</span> : null}
      {o ? (
        <>
          {o.status === 'IN_DEAL' ? <Link href="/sales?tab=deals" className="ha-sd__btn">Em venda · acompanhar</Link> : (
            <button type="button" className={`ha-sd__btn${o.sealGreen ? '' : ' ha-sd__btn--primary'}`} onClick={() => setSheet('services')}><Icon name="home_repair_service" size={20} />{o.sealGreen ? 'Serviços' : 'Certificar e outros serviços'}</button>
          )}
          {o.status === 'LISTED' ? <Link href="/sales" className="ha-sd__btn">Anunciada · ver ofertas</Link>
            : o.status === 'AUTHENTICATED' ? <button type="button" className="ha-sd__btn ha-sd__btn--ink" onClick={() => setSheet('sell')}>Vender esta obra</button> : null}
        </>
      ) : null}
    </div>
  )

  return (
    <SidePanel title={a.title} hideTitle closeHref={closeHref} actions={actions} footer={footer}>
      <div className="ha-cp__bleed">
        <button type="button" className={`ha-cp__view${zoom ? ' ha-cp__view--zoom' : ''}`} aria-label={zoom ? 'Afastar' : 'Ampliar no ponto'} disabled={!cur}
          onClick={(e) => { if (zoom) { setZoom(null); return } const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }) }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
          {cur ? <img src={cur.url} alt={a.title} draggable={false} style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} /> : <Icon name="imagesmode" size={40} />}
          {cur ? <span className="ha-cp__zoomtip"><Icon name={zoom ? 'zoom_out' : 'zoom_in'} size={16} />{zoom ? 'Toque para afastar' : 'Toque no ponto para ampliar'}</span> : null}
        </button>
      </div>
      {a.images.length > 1 ? (
        <div className="ha-cp__thumbs">
          {a.images.map((im, i) => (
            <button key={im.url} type="button" className={`ha-cp__thumb${i === photo ? ' ha-cp__thumb--on' : ''}`} aria-pressed={i === photo} onClick={() => { setPhoto(i); setZoom(null) }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
              <span><img src={im.url} alt="" /></span>{im.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ha-cp__id">
        {a.artistSlug ? <Link href={`/e/artist/${a.artistSlug}`} className="ha-cp__artist">{a.artist}<Icon name="chevron_right" size={18} /></Link> : <span className="ha-cp__artist">{a.artist}</span>}
        <h2 className="ha-cp__title">{a.title}</h2>
        {a.ficha ? <span className="ha-cp__ficha">{a.ficha}</span> : null}
      </div>
      <div className="ha-cp__price">
        <span className="ha-stack" style={{ gap: 0 }}><span className="ha-cp__muted">{a.priceLabel}</span><b>{a.price}</b>{a.priceSub ? <span className="ha-cp__muted">{a.priceSub}</span> : null}</span>
        {sig ? (
          <span className="ha-row ha-cp__social">
            <span className="ha-cp__muted ha-row" style={{ gap: 4 }}><Icon name="favorite" size={16} />{sig.likes}</span>
            <button type="button" className="ha-cp__comments" aria-label={`Comentários (${sig.comments})`} onClick={() => setSheet('comments')}><Icon name="chat_bubble" size={16} />{sig.comments}</button>
          </span>
        ) : null}
      </div>
      <div className={`ha-cp__cert${a.certificate.ok ? '' : ' ha-cp__cert--warn'}`}>
        <span className="ha-cp__cert-h"><Icon name={a.certificate.ok ? 'verified' : 'schedule'} size={20} filled />Certificado HouseArt</span>
        <span className="ha-cp__cert-t">{a.certificate.text}</span>
        {a.certificate.code ? <><span className="ha-cp__cert-code">{a.certificate.code}</span><Link href={`/verify/${a.certificate.code}`} className="ha-cp__cert-a">Ver certificado público →</Link></> : null}
      </div>
      {a.provenance.length ? (
        <div className="ha-cp__prov">
          <span className="ha-cp__h">Proveniência</span>
          {a.provenance.map((p, i) => <div key={i} className="ha-cp__prov-i"><span className="ha-cp__dot" /><span className="ha-stack" style={{ gap: 0 }}><b>{p.k}</b><span className="ha-cp__muted">{p.v}</span></span></div>)}
        </div>
      ) : null}
      {a.seller ? (
        <div className="ha-sd__buyer">
          <span className="ha-sd__av" aria-hidden="true">{a.seller.initials}</span>
          <span className="ha-stack" style={{ flex: 1, minWidth: 0, gap: 0 }}><b className="ha-sm">{a.seller.name}</b><span className="ha-cp__muted">{a.seller.sub}</span></span>
          <button type="button" className="ha-cp__talk" disabled={busy} onClick={talk}><Icon name="chat_bubble" size={18} />Conversar</button>
        </div>
      ) : null}
      {o ? (
        <div className="ha-cp__deed">
          <span className="ha-cp__h">Escritura</span>
          <dl>
            <div><dt>Titular</dt><dd>{o.holderName}{o.holderMask ? ` · CPF ${o.holderMask}` : ''}</dd></div>
            <div><dt>Desde</dt><dd>{o.acquiredAt} · versão {o.version}</dd></div>
            <div><dt>Apólice</dt><dd>{o.insurer ?? 'Sem apólice'}</dd></div>
          </dl>
          <div className="ha-cp__deed-acts">
            {o.transferOn ? <Link href={`/transfer?artworkId=${a.id}`} className="ha-btn ha-btn--outline ha-btn--sm">Transferir</Link> : null}
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={o.insured || busy} onClick={() => post(`/api/wallet/${a.id}/insure`, {}, (d) => `Cotação aceita · ${d.insurer} — apólice emitida`)}>Segurar</button>
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={busy} onClick={() => post('/api/appraisals', { artworkId: a.id, purpose: 'INSURANCE', requesterLabel: 'Colecionador' }, (d) => `Laudo pedido · avaliador credenciado em até 5 dias${d.orderCode ? ` · pedido ${d.orderCode}` : ''}`)}>Pedir laudo</button>
            {o.restoreBlocked ? null : <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={busy} onClick={() => { setRestoreError(''); setSheet('restore') }}>Registrar restauro</button>}
            {a.publicId ? <Link href={`/verify/${a.publicId}`} className="ha-btn ha-btn--outline ha-btn--sm">Compartilhar certificado</Link> : null}
          </div>
        </div>
      ) : (
        <div className="ha-cp__notes">
          <span><Icon name="lock" size={16} />Pagamento em garantia: o vendedor só recebe quando você confirma a entrega.</span>
          <span><Icon name="contactless" size={16} />Na entrega, o toque na etiqueta transfere a escritura para o seu nome.</span>
        </div>
      )}
      {/* the sheets render on <body>: the panel's slide-in transform would make it their containing block */}
      {o && sheet === 'sell' ? createPortal(<SellSheet open onClose={() => setSheet(null)} onCertify={() => setSheet('services')} artwork={{ artworkId: a.id, title: a.title, artist: a.artist, cover: o.cover, status: o.status, sealGreen: o.sealGreen, registeredCents: o.registeredCents }} />, document.body) : null}
      {o && sheet === 'services' ? createPortal(<ServicesSheet open onClose={() => setSheet(null)} onDone={setToast} artworkId={a.id} title={a.title} sealGreen={o.sealGreen} />, document.body) : null}
      {o && sheet === 'restore' ? createPortal(
        <Modal open title="Registrar restauro" onClose={() => setSheet(null)} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={submitRestoration}>{busy ? 'Registrando…' : 'Registrar na proveniência'}</button>}>
          <p className="ha-muted ha-sm">O restauro entra na cadeia do certificado como um evento assinado: quem vier a comprar a obra lê que ela passou por intervenção, quando e por quem. Não dá para editar depois.</p>
          <label className="ha-label">O que foi feito<textarea className="ha-textarea" rows={4} maxLength={RESTORATION_DESCRIPTION_MAX} value={restore.description} onChange={(e) => setRestore({ ...restore, description: e.target.value })} placeholder="Limpeza da superfície, reentelamento e verniz refeito" /></label>
          <span className="ha-muted ha-sm">{restore.description.trim().length} de {RESTORATION_DESCRIPTION_MAX} · mínimo {RESTORATION_DESCRIPTION_MIN}</span>
          <label className="ha-label">Restaurador ou ateliê · opcional<input className="ha-input" maxLength={120} value={restore.restorer} onChange={(e) => setRestore({ ...restore, restorer: e.target.value })} /></label>
          <label className="ha-label">Data do restauro · opcional<input className="ha-input" type="date" max={todayIso()} value={restore.on} onChange={(e) => setRestore({ ...restore, on: e.target.value })} /></label>
          {restoreError ? <p className="ha-field-error" role="alert">{restoreError}</p> : null}
        </Modal>, document.body) : null}
      {sheet === 'comments' && sig ? (
        <CommentsSheet item={{ key: `a${a.id}`, id: a.id, target: 'ARTWORK', author: { memberId: null, name: a.seller?.name ?? '' } }} me={{ initials: meInitials }} onClose={() => setSheet(null)} onToast={setToast}
          onCount={(_k, delta) => setSig((s) => (s ? { ...s, comments: Math.max(0, s.comments + delta) } : s))} />
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </SidePanel>
  )
}
