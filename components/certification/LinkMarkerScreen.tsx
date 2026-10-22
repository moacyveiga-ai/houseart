'use client'
// "Vincular etiqueta" (handoff "HouseArt App Artista" › leitor, LT.vincular):
// the pulsing ring while the phone reads the tag (Web NFC), "Etiqueta
// vinculada · <título> · HA-…", the CTA that signs the certificate (the same
// route of the Certification screen) and "Certificado assinado". Without Web
// NFC (desktop, iOS) the QR/URL alternative: paste the URL of the tag; in dev
// (MARKER_VENDOR=mock) a simulated tap by UID.
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { initialLinkState, linkErrorMessage, linkReducer, linkTexts, parsePastedMarker, parseSunUrl, type SunRead } from './link-marker-core'
import './link-marker.css'

// Web NFC (Chrome on Android only) — minimal surface, the lib.dom has no types for it.
interface NdefRecordLike { recordType: string; data?: DataView; encoding?: string }
interface NdefReadingEventLike { serialNumber?: string; message: { records: NdefRecordLike[] } }
interface NdefReaderLike { scan(opts?: { signal?: AbortSignal }): Promise<void>; onreading: ((e: NdefReadingEventLike) => void) | null; onreadingerror: ((e: Event) => void) | null }
declare global { interface Window { NDEFReader?: new () => NdefReaderLike } }

export interface LinkMarkerProps {
  artworkId: number
  artworkTitle: string
  /** already linked (page reload after the link): starts at "Etiqueta vinculada" */
  publicId: string | null
  /** the certificate the link created; null until the page re-renders after the link */
  certificateId: number | null
  /** MARKER_VENDOR=mock outside production: shows "Simular toque" */
  simulateAllowed: boolean
}

type NfcState = 'idle' | 'scanning' | 'denied'
const noSubscribe = () => () => {}
/** Web NFC exists only in Chrome on Android; the server (and the first client render) assume it does, the hint appears after hydration. */
const useNfcSupported = () => useSyncExternalStore(noSubscribe, () => typeof window !== 'undefined' && !!window.NDEFReader, () => true)

export function LinkMarkerScreen({ artworkId, artworkTitle, publicId, certificateId, simulateAllowed }: LinkMarkerProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(linkReducer, publicId, initialLinkState)
  const supported = useNfcSupported()
  const [nfc, setNfc] = useState<NfcState>('idle')
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [altPref, setAltPref] = useState<boolean | null>(null)
  const altOpen = altPref ?? !supported // without Web NFC the QR/URL alternative is already open
  const [toast, setToast] = useState('')
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const texts = linkTexts(state, artworkTitle)

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (busy.current) return
    busy.current = true
    try {
      let res: Response
      try { res = await fetch('/api/markers/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } catch { dispatch({ type: 'FAILED', message: linkErrorMessage(0, null) }); return }
      const data = await res.json().catch(() => ({})) as { error?: unknown; publicId?: unknown }
      if (!res.ok || typeof data.publicId !== 'string') { dispatch({ type: 'FAILED', message: linkErrorMessage(res.status, data) }); return }
      dispatch({ type: 'LINKED', publicId: data.publicId })
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(60)
      router.refresh() // the page re-renders with the certificate the link created
    } finally { busy.current = false }
  }, [router])

  const linkRead = useCallback((read: SunRead) => post({ ...read, artworkId }), [post, artworkId])
  const simulate = useCallback((uid: string) => post({ uid, artworkId, simulate: true }), [post, artworkId])

  // Web NFC: scan while reading; a `url` record carries the SUN query.
  useEffect(() => {
    if (state.phase !== 'reading') { abort.current?.abort(); abort.current = null; return }
    if (!supported || !window.NDEFReader) return
    const ctl = new AbortController(); abort.current = ctl
    const reader = new window.NDEFReader()
    reader.onreading = (e) => {
      for (const r of e.message.records) {
        if (r.recordType !== 'url' || !r.data) continue
        const url = new TextDecoder().decode(r.data)
        const read = parseSunUrl(url)
        if (read) { void linkRead(read); return }
      }
      const serial = (e.serialNumber ?? '').replace(/[^0-9a-f]/gi, '').toLowerCase()
      if (simulateAllowed && /^[0-9a-f]{14}$/.test(serial)) { void simulate(serial); return }
      dispatch({ type: 'FAILED', message: 'A etiqueta não trouxe uma leitura válida. Encoste de novo, bem no centro.' })
    }
    reader.onreadingerror = () => dispatch({ type: 'FAILED', message: 'Não deu para ler a etiqueta. Encoste de novo, bem no centro.' })
    reader.scan({ signal: ctl.signal }).then(() => setNfc('scanning')).catch(() => { if (!ctl.signal.aborted) { setNfc('denied'); setAltPref(true) } })
    return () => { ctl.abort() }
  }, [state.phase, linkRead, simulate, simulateAllowed, supported])

  // The certificate id arrives with the refresh; if it is late, ask again a few times.
  useEffect(() => {
    if (state.phase !== 'linked' || certificateId) return
    let tries = 0
    const t = window.setInterval(() => { tries += 1; router.refresh(); if (tries >= 5) window.clearInterval(t) }, 1500)
    return () => window.clearInterval(t)
  }, [state.phase, certificateId, router])

  async function sign() {
    if (!certificateId || state.phase !== 'linked') return
    dispatch({ type: 'SIGN_START' })
    let res: Response
    try { res = await fetch(`/api/certificates/${certificateId}/sign`, { method: 'POST' }) } catch { dispatch({ type: 'SIGN_FAILED', message: 'Sem conexão. Tente de novo.' }); return }
    const data = await res.json().catch(() => ({})) as { error?: unknown }
    if (!res.ok) { dispatch({ type: 'SIGN_FAILED', message: typeof data.error === 'string' ? data.error : 'Não foi possível assinar.' }); return }
    dispatch({ type: 'SIGNED' })
    setToast(`${artworkTitle} · certificado assinado`)
    // no router.refresh() here: the page would swap the island for the "already signed" notice
  }

  function submitPasted() {
    const p = parsePastedMarker(pasted)
    if (!p) { setPasteError('Cole a URL gravada na etiqueta (com uid, ctr e cmac)' + (simulateAllowed ? ' ou o UID de 14 caracteres.' : '.')); return }
    setPasteError(null)
    if (p.kind === 'sun') void linkRead(p.read)
    else if (simulateAllowed) void simulate(p.uid)
    else setPasteError('Só o UID não basta: a leitura precisa da URL completa da etiqueta (uid, ctr e cmac).')
  }

  const ring = state.phase === 'reading' ? 'reading' : state.phase === 'error' ? 'error' : state.phase === 'signed' ? 'signed' : 'ok'

  return (
    <div className="ha-tag-link" data-phase={state.phase}>
      <div className="ha-tag-link__top">
        <a className="ha-tag-link__back" href="/certification" aria-label="Voltar"><Icon name="arrow_back" size={26} /></a>
        <span className="ha-tag-link__topname">{texts.top}</span>
        <span className="ha-tag-link__spacer" />
      </div>

      <div className="ha-tag-link__body">
        <div className={`ha-tag-link__ring ha-tag-link__ring--${ring}`} aria-hidden>
          {ring === 'reading' ? (<><span className="ha-reader__pulse" /><span className="ha-reader__pulse ha-reader__pulse--late" /><span className="ha-tag-link__core"><Icon name="contactless" size={32} /></span></>) : null}
          {ring === 'ok' ? <Icon name="check" size={48} /> : null}
          {ring === 'signed' ? <Icon name="verified" size={48} filled /> : null}
          {ring === 'error' ? <Icon name="link_off" size={48} /> : null}
        </div>
        <div className="ha-tag-link__texts" role="status" aria-live="polite">
          <div className="ha-tag-link__title">{texts.title}</div>
          <div className="ha-tag-link__text">{texts.text}</div>
          {state.phase === 'linked' && state.error ? <div className="ha-tag-link__err">{state.error}</div> : null}
        </div>
        {state.phase === 'linked' || state.phase === 'signing' ? (
          <p className="ha-tag-link__decl">Ao assinar, você declara ser a autora desta obra. O certificado recebe carimbo do tempo e não pode ser alterado; mudanças futuras viram novos eventos na cadeia de titularidade.</p>
        ) : null}
      </div>

      {state.phase === 'linked' || state.phase === 'signing' ? (
        <button type="button" className="ha-btn ha-btn--primary ha-btn--lg ha-tag-link__cta" disabled={state.phase === 'signing' || !certificateId} onClick={sign}>
          {state.phase === 'signing' ? 'Assinando…' : certificateId ? texts.cta : 'Preparando o certificado…'}
        </button>
      ) : null}
      {state.phase === 'signed' ? <a className="ha-btn ha-btn--primary ha-btn--lg ha-tag-link__cta" href="/certification">{texts.cta}</a> : null}
      {state.phase === 'error' ? <button type="button" className="ha-btn ha-btn--primary ha-btn--lg ha-tag-link__cta" onClick={() => dispatch({ type: 'RETRY' })}>{texts.cta}</button> : null}

      {state.phase === 'reading' ? (
        <div className="ha-tag-link__alt">
          {!supported ? <p className="ha-tag-link__hint">Este navegador não lê NFC. No celular, abra o app ou use a leitura pelo QR.</p> : null}
          {nfc === 'denied' ? <p className="ha-tag-link__hint">A leitura NFC não foi liberada. Permita o acesso ou use a leitura pelo QR.</p> : null}
          <button type="button" className="ha-tag-link__qr" aria-expanded={altOpen} onClick={() => setAltPref(!altOpen)}><Icon name="qr_code_scanner" size={18} />Ler o QR da etiqueta</button>
          {altOpen ? (
            <form className="ha-tag-link__paste" onSubmit={(e) => { e.preventDefault(); submitPasted() }}>
              <label className="ha-tag-link__label" htmlFor="ha-tag-link-paste">URL lida no QR{simulateAllowed ? ' ou UID da etiqueta' : ''}</label>
              <input id="ha-tag-link-paste" className="ha-input ha-tag-link__input" placeholder="https://…/a/…?uid=…&ctr=…&cmac=…" value={pasted} onChange={(e) => { setPasted(e.target.value); setPasteError(null) }} autoComplete="off" spellCheck={false} />
              {pasteError ? <span className="ha-tag-link__err">{pasteError}</span> : null}
              <div className="ha-tag-link__paste-actions">
                <button type="submit" className="ha-btn ha-btn--outline-paper ha-btn--md" disabled={!pasted.trim()}>Vincular</button>
                {simulateAllowed ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--md ha-tag-link__sim" disabled={parsePastedMarker(pasted)?.kind !== 'uid'} onClick={() => { const p = parsePastedMarker(pasted); if (p?.kind === 'uid') void simulate(p.uid) }}>Simular toque</button> : null}
              </div>
              {simulateAllowed ? <span className="ha-tag-link__hint">Ambiente de desenvolvimento: “Simular toque” vale como a leitura da etiqueta pelo UID.</span> : null}
            </form>
          ) : null}
        </div>
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
