'use client'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'

const STEPS = ['Comprador', 'Valor', 'Assinaturas', 'Toque do comprador']

export interface TransferState { id: number; status: string; sellerSignedAt: string | null; buyerSignedAt: string | null; toName: string; priceCents: string | null; priceSealed: boolean; royaltyCents: string; feeCents: string }

export function TransferWizard({ artwork, existing }: { artwork: { id: number; title: string; year: number | null; artist: string; publicId: string | null }; existing: TransferState | null }) {
  const [t, setT] = useState<TransferState | null>(existing)
  const [step, setStep] = useState(existing ? (existing.status === 'AWAITING_TAP' || existing.status === 'COMPLETED' ? 3 : 2) : 0)
  const [form, setForm] = useState({ toDocument: '', toEmail: '', toName: '', price: '', priceSealed: false })
  const [preview, setPreview] = useState<{ royaltyCents: string; appreciationCents: string; artistName: string; forCents: number } | null>(null)
  const [toast, setToast] = useState('')
  const priceCents = Math.round(Number(form.price.replace(/\D/g, '')) * 100)

  useEffect(() => {
    if (step !== 1 || !priceCents) return
    let alive = true
    const h = window.setTimeout(async () => {
      const res = await fetch(`/api/ownership/preview?artworkId=${artwork.id}&priceCents=${priceCents}`)
      if (res.ok && alive) setPreview({ ...(await res.json()), forCents: priceCents })
    }, 400)
    return () => { alive = false; window.clearTimeout(h) }
  }, [step, priceCents, artwork.id])
  const livePreview = preview && preview.forCents === priceCents && step === 1 ? preview : null

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
    return { res, data: await res.json().catch(() => ({})) as Record<string, unknown> }
  }
  async function create() {
    const { res, data } = await post('/api/ownership/transfers', { artworkId: artwork.id, ...form, priceCents })
    if (!res.ok) { setToast(String(data.error ?? 'Não foi possível iniciar.')); return }
    setT({ id: Number(data.id), status: 'INVITED', sellerSignedAt: null, buyerSignedAt: null, toName: form.toName, priceCents: String(priceCents), priceSealed: form.priceSealed, royaltyCents: String(data.royaltyCents ?? '0'), feeCents: String(data.feeCents ?? '19900') })
    setStep(2); setToast('Convite enviado ao comprador')
  }
  async function sign() {
    if (!t) return
    const { res, data } = await post(`/api/ownership/transfers/${t.id}/sign`)
    if (!res.ok) { setToast(String(data.error ?? 'Falha')); return }
    setT({ ...t, sellerSignedAt: new Date().toISOString(), status: t.buyerSignedAt ? 'SIGNED' : 'SELLER_SIGNED' })
  }
  async function pay() {
    if (!t) return
    const { res, data } = await post(`/api/ownership/transfers/${t.id}/pay`)
    if (!res.ok) { setToast(String(data.error ?? 'Falha')); return }
    setT({ ...t, status: 'AWAITING_TAP' }); setStep(3); setToast('Taxa paga · aguardando o toque do comprador')
  }
  const next = () => {
    if (step === 0) { if (!form.toDocument || !form.toEmail || !form.toName) { setToast('Preencha o comprador.'); return } setStep(1) }
    else if (step === 1) { if (!priceCents) { setToast('Informe o valor.'); return } void create() }
    else if (step === 2) { if (t?.status === 'SIGNED') void pay(); else setToast('Faltam assinaturas.') }
    else window.location.assign('/wallet')
  }
  const bothSigned = !!t?.sellerSignedAt && !!t?.buyerSignedAt
  return (
    <div className="ha-stack">
      <p className="ha-muted">Vendeu fora da HouseArt? Registre a nova titularidade.</p>
      <h1 className="ha-h1">Transferir obra</h1>
      <div className="ha-row">{STEPS.map((s, i) => <span key={s} className={`ha-chip${i === step ? ' ha-chip--on' : ''}`}>{s}</span>)}</div>
      <div className="ha-card ha-card--pad"><b>{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</b><br /><span className="ha-muted ha-sm">{artwork.artist} · {artwork.publicId}</span></div>
      {step === 0 ? (
        <div className="ha-stack">
          <label className="ha-label">CPF do comprador<input className="ha-input" inputMode="numeric" value={form.toDocument} onChange={(e) => setForm({ ...form, toDocument: e.target.value })} /></label>
          <label className="ha-label">Nome do comprador<input className="ha-input" value={form.toName} onChange={(e) => setForm({ ...form, toName: e.target.value })} /></label>
          <label className="ha-label">E-mail ou celular<input className="ha-input" value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })} /></label>
          <p className="ha-muted ha-sm">O comprador recebe um convite para confirmar a identidade (CPF e biometria) antes de assinar.</p>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="ha-stack">
          <label className="ha-label">Valor da venda (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label className="ha-row"><input type="checkbox" checked={form.priceSealed} onChange={(e) => setForm({ ...form, priceSealed: e.target.checked })} /> Preço selado</label>
          <p className="ha-muted ha-sm">O valor fica registrado e assinado, mas não aparece na página pública.</p>
          {livePreview && BigInt(livePreview.royaltyCents) > 0n ? <div className="ha-callout"><Icon name="autorenew" /><div>Direito de sequência: <b>{formatBRL(BigInt(livePreview.royaltyCents))}</b> (5% da valorização de {formatBRL(BigInt(livePreview.appreciationCents))}) será repassado a {livePreview.artistName}.</div></div> : null}
        </div>
      ) : null}
      {step === 2 && t ? (
        <div className="ha-stack">
          <div className="ha-list">
            <div className="ha-list__row" style={{ gridTemplateColumns: '1fr auto' }}><span>Você · vendedor</span>{t.sellerSignedAt ? <span className="ha-muted ha-sm">Assinado {new Date(t.sellerSignedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" onClick={sign}>Assinar</button>}</div>
            <div className="ha-list__row" style={{ gridTemplateColumns: '1fr auto' }}><span>{t.toName} · comprador(a)</span><span className="ha-muted ha-sm">{t.buyerSignedAt ? 'Assinado' : 'Aguardando assinatura'}</span></div>
          </div>
          <p className="ha-muted ha-sm">Termo de transferência assinado digitalmente, com carimbo do tempo ICP-Brasil.</p>
          <div className="ha-row"><span>Taxa de transferência</span><b className="ha-num">{formatBRL(BigInt(t.feeCents))}</b></div>
        </div>
      ) : null}
      {step === 3 && t ? (
        <div className="ha-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="ha-ring"><span className="ha-ring__pulse" /><span className="ha-ring__core"><Icon name="contactless" size={28} /></span></span>
          <b>{t.status === 'COMPLETED' ? 'Transferência concluída' : `Falta o toque de ${t.toName}`}</b>
          <p className="ha-muted ha-sm">Com a obra em mãos, {t.toName.split(' ')[0]} encosta o celular na etiqueta do verso. A leitura prova a posse e a escritura passa para o nome dela.</p>
        </div>
      ) : null}
      <div className="ha-row ha-row--end">
        <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => (step === 0 ? window.location.assign('/wallet') : setStep(step - 1))} disabled={step >= 2 && !!t}>Voltar</button>
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={next} disabled={step === 2 && !bothSigned}>{step === 2 ? `Pagar ${formatBRL(BigInt(t?.feeCents ?? '19900'))} e concluir` : step === 3 ? 'Voltar à carteira' : 'Continuar'}</button>
      </div>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
