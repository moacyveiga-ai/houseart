'use client'
// Instagram (handoff "HouseArt Web Galeria" › Instagram; "App Colecionador" › Instagram · conectar e
// postar): not connected → the hero, the three benefits and "Conectar com Instagram"; connected → the
// account, the three preferences, the posts sent with reach and visits, "Em breve" for boosting, and
// "Desconectar". Without the app keys the button says "Em breve" (nothing is simulated in production).
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { Toggle } from '@/components/ds/Toggle'
import { BENEFITS, PREFS, type PrefKey } from '@/lib/instagram/core'
import type { InstagramView } from '@/lib/instagram/server'

export function InstagramScreen({ view, back, outcome }: { view: InstagramView; back: string; outcome: string | null }) {
  const router = useRouter()
  const [prefs, setPrefs] = useState(view.connection?.prefs ?? null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(outcome ?? '')
  const clear = useCallback(() => setToast(''), [])
  const c = view.connection

  async function connect() {
    setBusy(true)
    const res = await fetch('/api/instagram/connect', { method: 'POST' })
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || !data.url) { setBusy(false); setToast(data.error ?? 'Não foi possível abrir o Instagram.'); return }
    window.location.assign(data.url)
  }

  async function setPref(key: PrefKey, on: boolean) {
    if (!prefs) return
    const before = prefs
    setPrefs({ ...prefs, [key]: on })
    const res = await fetch('/api/instagram', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: on }) })
    if (!res.ok) { setPrefs(before); setToast('Não foi possível salvar.') }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar o Instagram? Os posts já publicados continuam lá.')) return
    setBusy(true)
    const res = await fetch('/api/instagram', { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { setToast('Não foi possível desconectar.'); return }
    setToast('Instagram desconectado')
    router.replace('/instagram')
    router.refresh()
  }

  async function retry(id: number) {
    const res = await fetch(`/api/instagram/publications/${id}/retry`, { method: 'POST' })
    setToast(res.ok ? 'Enviando de novo ao Instagram' : 'Não foi possível tentar de novo.')
    if (res.ok) router.refresh()
  }

  return (
    <div className="ha-ig">
      <div className="ha-ig__bar">
        <Link href={back} className="ha-ig__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link>
        <h1 className="ha-ig__title">Instagram</h1>
      </div>

      {!c ? (
        <>
          <div className="ha-ig__hero">
            <span className="ha-ig__mark" aria-hidden="true"><Icon name="photo_camera" size={30} /></span>
            <h2 className="ha-ig__lead">Leve seus posts para o Instagram</h2>
            <p className="ha-ig__text">Publique na comunidade e no seu Instagram ao mesmo tempo. Quem abrir o link chega à página pública da obra, com certificado e compra.</p>
          </div>
          <ul className="ha-ig__benefits">
            {BENEFITS.map((b) => <li key={b.icon}><Icon name={b.icon} size={20} />{b.text}</li>)}
          </ul>
          {view.mode === 'OFF' ? (
            <button type="button" className="ha-ig__connect" disabled>Em breve</button>
          ) : (
            <button type="button" className="ha-ig__connect" onClick={connect} disabled={busy}>{busy ? 'Abrindo o Instagram…' : 'Conectar com Instagram'}</button>
          )}
          <p className="ha-ig__fine">Precisa de conta profissional ou de criador. Nada é publicado sem você pedir, e dá para desconectar quando quiser.{view.mode === 'MOCK' ? ' Ambiente de teste: a conexão é simulada.' : ''}</p>
        </>
      ) : (
        <>
          <div className="ha-ig__account">
            <span className="ha-ig__mark ha-ig__mark--sm" aria-hidden="true"><Icon name="photo_camera" size={22} /></span>
            <span className="ha-ig__who"><span className="ha-ig__handle">{c.handle}</span><span className="ha-ig__meta">{[c.account, c.followers].filter(Boolean).join(' · ')}</span></span>
            {c.status === 'CONNECTED'
              ? <span className="ha-ig__ok"><Icon name="check_circle" size={18} />Conectado</span>
              : <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={connect} disabled={busy || view.mode === 'OFF'}>Conectar de novo</button>}
          </div>
          {c.status !== 'CONNECTED' && c.lastError ? <p className="ha-ig__warn">{c.lastError}</p> : null}

          <div className="ha-ig__card">
            {PREFS.map((p) => (
              <div key={p.key} className="ha-ig__pref">
                <span className="ha-ig__pref-text"><span className="ha-ig__pref-name">{p.name}</span><span className="ha-ig__pref-sub">{p.sub}</span></span>
                <Toggle on={!!prefs?.[p.key]} label={p.name} onChange={(on) => void setPref(p.key, on)} />
              </div>
            ))}
          </div>

          <div className="ha-ig__card">
            <span className="ha-ig__section">Publicados pela HouseArt</span>
            {view.publications.length === 0 ? <span className="ha-ig__empty">Nenhum post enviado ainda. Ligue a opção ao criar um post na <Link href="/community">comunidade</Link>.</span> : null}
            {view.publications.map((p) => (
              <div key={p.id} className="ha-ig__post">
                {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                <span className="ha-ig__thumb">{p.image ? <img src={p.image} alt="" /> : <Icon name="imagesmode" size={22} />}</span>
                <span className="ha-ig__post-text"><span className="ha-ig__post-title">{p.text}</span><span className={`ha-ig__post-stats${p.status === 'FAILED' ? ' ha-ig__post-stats--bad' : ''}`}>{p.stats}</span></span>
                {p.canRetry ? <button type="button" className="ha-btn ha-btn--outline ha-btn--xs" onClick={() => void retry(p.id)}>Tentar de novo</button> : null}
              </div>
            ))}
          </div>

          <div className="ha-ig__soon">
            <span className="ha-ig__soon-title"><Icon name="rocket_launch" size={18} />Em breve: impulsionar e captar contatos</span>
            <span className="ha-ig__soon-text">Impulsione um post com orçamento diário, escolha o público por cidade e interesse, e receba os contatos de quem abrir a obra direto nas suas mensagens.</span>
          </div>

          <button type="button" className="ha-ig__disconnect" onClick={disconnect} disabled={busy}>Desconectar Instagram</button>
          <p className="ha-ig__fine">Para tirar o acesso também do lado do Instagram: Configurações › Apps e sites, no próprio Instagram.</p>
        </>
      )}
      <Toast message={toast} onDone={clear} />
    </div>
  )
}
