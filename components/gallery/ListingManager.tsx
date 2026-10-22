'use client'
// "Gestão do anúncio": stats, the asked price (Salvar lights when it changed),
// "Aceita ofertas" and "Pausar anúncio" over PATCH /api/artworks/<id>/listing,
// and the three buttons of the prototype. The floor never reaches this screen.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import { Toast } from '@/components/ds/Toast'
import { acceptsOffersSub, listingStats, pauseToggledMessage, pausedSub, priceCents, priceChanged, priceMask, priceSavedMessage, publicArtworkPath, shareMessage, type ToggleRules } from './listing-manager-core'
import './listing-manager.css'

export interface ListingState { listPriceCents: string; acceptsOffers: boolean; paused: boolean; stats: { views7d: number; openOffers: number } }
interface Props { artworkId: number; title: string; artistName: string; publicId: string | null; initial: ListingState; rules: ToggleRules | null }

export function ListingManager({ artworkId, title, artistName, publicId, initial, rules }: Props) {
  const [state, setState] = useState<ListingState>(initial)
  const [price, setPrice] = useState(priceMask(Number(BigInt(initial.listPriceCents) / 100n)))
  const [busy, setBusy] = useState<'price' | 'offers' | 'pause' | null>(null)
  const [toast, setToast] = useState('')
  const changed = priceChanged(price, state.listPriceCents)

  async function patch(body: Record<string, unknown>, what: 'price' | 'offers' | 'pause'): Promise<ListingState | null> {
    setBusy(what)
    try {
      const res = await fetch(`/api/artworks/${artworkId}/listing`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({})) as { error?: string; listing?: { listPriceCents: string | number; acceptsOffers: boolean; paused: boolean; stats: { views7d: number; openOffers: number } } }
      if (!res.ok || !data.listing) { setToast(data.error ?? 'Não foi possível salvar.'); return null }
      const next: ListingState = { listPriceCents: String(data.listing.listPriceCents), acceptsOffers: data.listing.acceptsOffers, paused: data.listing.paused, stats: data.listing.stats }
      setState(next)
      return next
    } catch { setToast('Sem conexão. Tente de novo.'); return null } finally { setBusy(null) }
  }

  async function savePrice() {
    if (!changed || busy) return
    const previous = BigInt(state.listPriceCents)
    const next = await patch({ listPriceCents: priceCents(price).toString() }, 'price')
    if (next) { setPrice(priceMask(Number(BigInt(next.listPriceCents) / 100n))); setToast(priceSavedMessage(BigInt(next.listPriceCents), previous)) }
  }

  async function share() {
    const url = `${window.location.origin}${publicArtworkPath(publicId ?? '')}`
    const text = shareMessage({ title, artistName }, url)
    try { await navigator.clipboard.writeText(text); setToast('Mensagem com o link copiada') } catch { setToast(url) }
  }

  return (
    <section className="ha-lm" aria-labelledby="lm-title">
      <h2 id="lm-title" className="ha-lm__head"><Icon name="tune" size={20} />Gestão do anúncio</h2>
      <div className="ha-lm__stats">
        {listingStats(state.stats).map((s) => <span key={s.label} className="ha-lm__stat"><span className="ha-lm__stat-value">{s.value}</span><span className="ha-lm__stat-label">{s.label}</span></span>)}
      </div>
      <form className="ha-lm__price" onSubmit={(e) => { e.preventDefault(); void savePrice() }}>
        <label className="ha-lm__label">Preço pedido
          <span className="ha-lm__field"><span className="ha-lm__currency">R$</span><input className="ha-lm__input" inputMode="numeric" value={price} onChange={(e) => setPrice(priceMask(e.target.value))} aria-label="Preço pedido em reais" /></span>
        </label>
        <button type="submit" className={`ha-lm__save${changed ? ' ha-lm__save--on' : ''}`} disabled={!changed || busy === 'price'} aria-busy={busy === 'price' || undefined}>Salvar</button>
      </form>
      <div className="ha-lm__toggle">
        <span className="ha-lm__toggle-text"><span className="ha-lm__toggle-name">Aceita ofertas</span><span className="ha-lm__toggle-sub">{acceptsOffersSub(state.acceptsOffers, rules)}</span></span>
        <Toggle on={state.acceptsOffers} label="Aceita ofertas" disabled={busy !== null} onChange={(on) => { void patch({ acceptsOffers: on }, 'offers') }} />
      </div>
      <div className="ha-lm__toggle">
        <span className="ha-lm__toggle-text"><span className="ha-lm__toggle-name">Pausar anúncio</span><span className="ha-lm__toggle-sub">{pausedSub(state.paused)}</span></span>
        <Toggle on={state.paused} label="Pausar anúncio" disabled={busy !== null} onChange={async (on) => { const next = await patch({ paused: on }, 'pause'); if (next) setToast(pauseToggledMessage(next.paused)) }} />
      </div>
      <div className="ha-lm__btns">
        <Link href="/sales" className="ha-lm__btn"><Icon name="request_quote" size={16} />Ofertas desta obra</Link>
        <button type="button" className="ha-lm__btn" onClick={() => { void share() }} disabled={!publicId}><Icon name="share" size={16} />Enviar a um cliente</button>
        <Link href={`/transfer?artworkId=${artworkId}`} className="ha-lm__btn"><Icon name="storefront" size={16} />Vendida fora</Link>
      </div>
      <Toast message={toast} onDone={() => setToast('')} />
    </section>
  )
}
