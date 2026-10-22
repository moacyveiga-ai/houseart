'use client'
// "Preencher com as fotos" (handoff "HouseArt App Colecionador" › Cadastrar
// obra, passo 3): the sand block at the top of the sheet. The route fills the
// EMPTY fields on the server; here we apply the same patch to the wizard state,
// highlight the filled inputs for a few seconds and relay the toast.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'
import { HIGHLIGHT_MS, readingPanelState, stateFromError, stateFromResponse, type HighlightableField, type ReadingPanelState, type ReadingResponse } from './reading-panel-core'
import './reading-panel.css'

export interface ReadingPatch { title?: string | number | null; year?: string | number | null; technique?: string | number | null; materials?: string | number | null; edition?: string | number | null; signatureLocation?: string | number | null }

export function ReadingPanel({ artworkId, disabled, onApplied, onToast, children }: {
  artworkId: number
  disabled?: boolean
  onApplied: (patch: ReadingPatch) => void
  onToast: (message: string) => void
  /** the form; receives the set of fields to highlight */
  children: (highlight: ReadonlySet<HighlightableField>) => ReactNode
}) {
  const [state, setState] = useState<ReadingPanelState>(() => readingPanelState({ phase: 'idle' }))
  const [highlight, setHighlight] = useState<ReadonlySet<HighlightableField>>(() => new Set())
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  async function read() {
    if (state.busy) return
    setState(readingPanelState({ phase: 'reading' }))
    let res: Response
    try { res = await fetch(`/api/artworks/${artworkId}/read-photos`, { method: 'POST' }) } catch { setState(stateFromError(0, null)); return }
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) { setState(stateFromError(res.status, body as { error?: unknown })); return }
    const r = stateFromResponse(body as ReadingResponse)
    setState(r.state)
    if (r.highlight.length) {
      onApplied(r.patch)
      setHighlight(new Set(r.highlight))
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setHighlight(new Set()), HIGHLIGHT_MS)
    }
    if (r.toast) onToast(r.toast)
  }

  return (
    <>
      <div className={`ha-reading${state.phase === 'applied' ? ' ha-reading--applied' : ''}`}>
        <button type="button" className="ha-reading__btn" disabled={disabled || state.busy} aria-busy={state.busy} onClick={read}>
          <Icon name={state.busy ? 'progress_activity' : 'auto_awesome'} size={24} className={state.busy ? 'ha-reading__spin' : ''} />
          <span className="ha-reading__text">
            <span className="ha-reading__title">{state.title}</span>
            <span className="ha-reading__sub">{state.subtitle}</span>
          </span>
        </button>
        {state.message ? <p className="ha-reading__msg" role="status">{state.message}</p> : null}
        {state.note ? <p className="ha-reading__note" role="status"><Icon name="info" size={16} />{state.note}</p> : null}
      </div>
      {children(highlight)}
    </>
  )
}
