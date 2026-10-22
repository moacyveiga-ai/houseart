'use client'
// "Comprar direto" (handoff App Colecionador › sheet `checkout` + sheet `cartao`),
// drawn on the web as one centred column with the artwork aside of the Oferta
// page on desktop. Blocks and texts follow the app: Entrega → Seguro parede a
// parede → Pagamento (saved cards, "Adicionar cartão" inline) → summary →
// "Em garantia até você confirmar a entrega" + the primary button.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import { formatBRL } from '@/lib/artworks/domain'
import { brandOf, checkCard, CARD_BRAND_LABELS, type PaymentMethodView } from '@/lib/payment-methods/domain'
import { normalizeCep } from '@/lib/shipping/quote-core'
import { blockedReason, checkoutTotals, ctaLabel, insuranceText, maskCardNumber, maskCep, maskExpiry, previewCardNumber, summaryLines, type DeliveryMode } from './checkout-core'

export interface CheckoutArtwork {
  publicId: string; title: string; year: number | null; artist: string; technique: string | null; dimensions: string; cover: string | null
  certified: boolean; priceCents: string
  seller: { name: string; kind: 'GALLERY' | 'PRIVATE'; city: string | null; uf: string | null }
}

interface Props { artwork: CheckoutArtwork; buyerName: string }

type Quote = { cep: string; shippingCents: number; insuranceCents: number }
const brl = (c: number) => formatBRL(c)

export function CheckoutScreen({ artwork, buyerName }: Props) {
  const price = Number(artwork.priceCents)
  const [delivery, setDelivery] = useState<DeliveryMode>('CARRIER')
  const [cep, setCep] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [insurance, setInsurance] = useState(true)
  const [cards, setCards] = useState<PaymentMethodView[] | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ code: string; card: PaymentMethodView | null } | null>(null)

  // Saved cards (GET /api/collector/payment-methods); the default one selected.
  useEffect(() => {
    let alive = true
    fetch('/api/collector/payment-methods', { cache: 'no-store' }).then((r) => r.json()).then((d: { methods?: PaymentMethodView[] }) => {
      if (!alive) return
      const list = d.methods ?? []
      setCards(list)
      setCardId(list.find((m) => m.isDefault)?.id ?? list[0]?.id ?? null)
      if (list.length === 0) setAdding(true)
    }).catch(() => { if (alive) setCards([]) })
    return () => { alive = false }
  }, [])

  // Shipping + insurance quote for the CEP (GET /api/public/shipping-quote).
  const cepNorm = normalizeCep(cep)
  const quoting = !!cepNorm && !quote
  useEffect(() => {
    if (!cepNorm) return
    let alive = true
    fetch(`/api/public/shipping-quote?publicId=${encodeURIComponent(artwork.publicId)}&cep=${cepNorm}&priceCents=${price}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; cep?: string | null; shippingCents?: string; insuranceCents?: string }) => {
        if (!alive) return
        setQuote(d.ok && d.cep ? { cep: d.cep, shippingCents: Number(d.shippingCents ?? 0), insuranceCents: Number(d.insuranceCents ?? 0) } : null)
      })
      .catch(() => { if (alive) setQuote(null) })
    return () => { alive = false }
  }, [cepNorm, artwork.publicId, price])

  const totals = useMemo(() => checkoutTotals({ priceCents: price, delivery, shippingCents: quote?.shippingCents ?? 0, insuranceCents: quote?.insuranceCents ?? 0, insurance }), [price, delivery, quote, insurance])
  const lines = summaryLines(totals, brl)
  const card = cards?.find((c) => c.id === cardId) ?? null
  const blocked = blockedReason({ delivery, cepValid: !!quote, hasCard: !!card })

  const onCardAdded = useCallback((m: PaymentMethodView) => {
    setCards((prev) => [...(prev ?? []).map((c) => (m.isDefault ? { ...c, isDefault: false } : c)), m])
    setCardId(m.id)
    setAdding(false)
    setError(null)
  }, [])

  async function confirm() {
    if (!card) { setAdding(true); return }
    if (blocked) { setError(blocked); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/public/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicId: artwork.publicId, paymentMethodId: card.id, deliveryCep: delivery === 'CARRIER' ? quote?.cep ?? null : null, insurance: delivery === 'CARRIER' && insurance }) })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; code?: string; error?: string }
    setBusy(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Não foi possível confirmar o pedido.'); return }
    setDone({ code: data.code ?? '', card })
  }

  const subtitle = `${artwork.artist} · ${artwork.seller.name}`
  const pickupPlace = [artwork.seller.city, artwork.seller.uf].filter(Boolean).join(', ') || 'Local combinado'

  if (done) {
    return (
      <div className="hc">
        <div className="hc-layout">
          <section className="hc-main hc-done" aria-live="polite">
            <span className="hc-done__icon"><Icon name="lock" size={28} /></span>
            <h1 className="hc-done__title">Pago em garantia</h1>
            <p className="hc-done__text">{done.card ? `${done.card.brandLabel} •••• ${done.card.last4} · ` : ''}o vendedor só recebe na entrega.</p>
            <p className="hc-muted">O valor de <b className="hc-num">{brl(totals.total)}</b> fica retido na HouseArt. Quando a obra chegar, confirme a entrega com o toque na etiqueta: o pagamento é liberado ao vendedor e a escritura passa para o seu nome no mesmo instante.{done.code ? <> Pedido <span className="hc-num">{done.code}</span>.</> : null}</p>
            <a href="/purchases" className="ha-btn ha-btn--primary ha-btn--md hc-cta"><Icon name="local_shipping" size={18} />Acompanhar a compra</a>
            <a href={`/e/artwork/${artwork.publicId}`} className="ha-link ha-link--quiet">Voltar para a obra</a>
          </section>
          <ArtworkAside artwork={artwork} lines={lines} total={totals.total} />
        </div>
      </div>
    )
  }

  return (
    <div className="hc">
      <div className="hc-layout">
        <section className="hc-main">
          <header className="hc-head">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="hc-head__thumb">{artwork.cover ? <img src={artwork.cover} alt="" /> : null}</span>
            <span className="hc-head__text"><i className="hc-head__title">{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</i><span className="hc-head__sub">{subtitle}</span></span>
          </header>
          <h1 className="hc-title">Comprar</h1>

          {/* Entrega */}
          <div className="hc-block">
            <span className="hc-block__label">Entrega</span>
            <div role="radiogroup" aria-label="Entrega" className="hc-options">
              <button type="button" role="radio" aria-checked={delivery === 'CARRIER'} className="hc-option" onClick={() => setDelivery('CARRIER')}>
                <Icon name={delivery === 'CARRIER' ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
                <span className="hc-option__text"><span className="hc-option__name">Transportadora especializada</span><span className="hc-option__sub">Embalagem museológica · 5 a 7 dias úteis</span></span>
                <span className="hc-option__price">{quote ? (quote.shippingCents ? brl(quote.shippingCents) : 'Grátis') : 'por CEP'}</span>
              </button>
              <button type="button" role="radio" aria-checked={delivery === 'PICKUP'} className="hc-option" onClick={() => setDelivery('PICKUP')}>
                <Icon name={delivery === 'PICKUP' ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
                <span className="hc-option__text"><span className="hc-option__name">Retirar com o vendedor</span><span className="hc-option__sub">{pickupPlace} · com hora marcada</span></span>
                <span className="hc-option__price">Grátis</span>
              </button>
            </div>
            {delivery === 'CARRIER' ? (
              <div className="hc-address">
                <Icon name="location_on" size={20} />
                <label className="hc-address__field">
                  <span>CEP de entrega</span>
                  <input className="ha-input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => { setCep(maskCep(e.target.value)); setQuote(null) }} aria-invalid={cep.length > 0 && !cepNorm ? true : undefined} />
                </label>
                <span className="hc-address__state">{quoting ? 'Calculando…' : quote ? 'Frete e seguro calculados' : 'Informe o CEP'}</span>
              </div>
            ) : null}
          </div>

          {/* Seguro parede a parede */}
          <div className={`hc-insure${delivery === 'PICKUP' ? ' hc-insure--off' : ''}`}>
            <Icon name="shield" size={22} />
            <span className="hc-option__text"><span className="hc-option__name">Seguro parede a parede</span><span className="hc-option__sub">{insuranceText({ delivery, insurance, insuranceCents: quote?.insuranceCents ?? 0, quoted: !!quote }, brl)}</span></span>
            <Toggle on={delivery === 'CARRIER' && insurance} onChange={setInsurance} label="Seguro parede a parede" disabled={delivery === 'PICKUP'} />
          </div>

          {/* Pagamento */}
          <div className="hc-block">
            <span className="hc-block__label">Pagamento</span>
            <div className="hc-pay-kind"><Icon name="credit_card" size={22} /><span className="hc-option__name">Cartão</span><span className="hc-option__sub">cobrado só agora, em garantia</span></div>
            {cards === null ? <span className="hc-muted">Carregando seus cartões…</span> : null}
            {cards && cards.length ? (
              <div role="radiogroup" aria-label="Cartão" className="hc-options">
                {cards.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={cardId === c.id} className="hc-option hc-option--card" onClick={() => { setCardId(c.id); setAdding(false) }}>
                    <Icon name={cardId === c.id ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
                    <BrandChip brand={c.brand} />
                    <span className="hc-option__text"><span className="hc-option__name hc-num">{c.brandLabel} •••• {c.last4}</span><span className="hc-option__sub">Vence {c.exp}{c.isDefault ? ' · padrão' : ''}</span></span>
                  </button>
                ))}
              </div>
            ) : null}
            {cards && !adding ? <button type="button" className="hc-add-card" onClick={() => setAdding(true)}><Icon name="add_card" size={20} />Adicionar cartão</button> : null}
            {adding ? <NewCardForm holderDefault={buyerName} firstCard={!cards || cards.length === 0} onSaved={onCardAdded} onCancel={cards && cards.length ? () => setAdding(false) : null} /> : null}
          </div>

          {/* Resumo */}
          <div className="hc-summary">
            {lines.map((l) => <div key={l.key} className="hc-summary__line"><span>{l.label}</span><span className="hc-num">{l.value}</span></div>)}
            <div className="hc-summary__total"><span>Total</span><span className="hc-num">{brl(totals.total)}</span></div>
          </div>

          <div className="hc-guarantee">
            <Icon name="verified_user" size={20} />
            <span><b>Garantia, escritura, frete e seguro.</b> O valor fica retido na HouseArt. O vendedor só recebe quando você confirmar a entrega com o toque na etiqueta, e a escritura muda para o seu nome no mesmo instante. Frete e seguro são calculados pelo CEP e pelo tamanho da obra.</span>
          </div>

          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <div className="hc-foot">
            <span className="hc-foot__lock"><Icon name="lock" size={14} />Em garantia até você confirmar a entrega</span>
            <button type="button" className="ha-btn ha-btn--primary ha-btn--md hc-cta" disabled={busy || (!!card && !!blocked)} aria-busy={busy || undefined} onClick={confirm}>{busy ? 'Confirmando…' : ctaLabel({ hasCard: !!card, total: totals.total }, brl)}</button>
          </div>
        </section>
        <ArtworkAside artwork={artwork} lines={lines} total={totals.total} />
      </div>
    </div>
  )
}

/** The Oferta page's aside: photo, artist, title, technique, "Certificada", "Vendido por", the summary. Desktop only (CSS). */
function ArtworkAside({ artwork, lines, total }: { artwork: CheckoutArtwork; lines: { key: string; label: string; value: string }[]; total: number }) {
  return (
    <aside className="hc-aside" aria-label="Resumo da obra">
      <div className="hc-aside__work">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
        <span className="hc-aside__thumb">{artwork.cover ? <img src={artwork.cover} alt="" /> : null}</span>
        <span className="hc-aside__text">
          <span className="hc-aside__artist">{artwork.artist}</span>
          <i className="hc-aside__title">{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</i>
          <span className="hc-aside__meta">{[artwork.technique, artwork.dimensions !== '—' ? artwork.dimensions : null].filter(Boolean).join(' · ')}</span>
          {artwork.certified ? <span className="hc-aside__cert"><Icon name="verified" size={14} filled />Certificada · {artwork.publicId}</span> : null}
        </span>
      </div>
      <div className="hc-aside__seller"><Icon name={artwork.seller.kind === 'GALLERY' ? 'storefront' : 'person'} size={18} /><span>Vendido por <b>{artwork.seller.name}</b> · {artwork.seller.kind === 'GALLERY' ? 'Galeria' : 'Colecionador'}</span></div>
      <dl className="hc-aside__summary">
        {lines.map((l) => <div key={l.key}><dt>{l.label}</dt><dd className="hc-num">{l.value}</dd></div>)}
        <div className="hc-aside__total"><dt>Total</dt><dd className="hc-num">{brl(total)}</dd></div>
      </dl>
      <span className="hc-aside__note">Em garantia até você confirmar a entrega com o toque na etiqueta.</span>
    </aside>
  )
}

function BrandChip({ brand }: { brand: string }) {
  if (brand === 'mastercard') return <span className="hc-brand hc-brand--mc" aria-hidden="true"><span /><span /></span>
  const txt = brand === 'visa' ? 'VISA' : brand === 'amex' ? 'AMEX' : brand === 'elo' ? 'elo' : brand === 'hipercard' ? 'Hiper' : '••'
  return <span className={`hc-brand hc-brand--${brand}`} aria-hidden="true">{txt}</span>
}

/** Sheet "Adicionar cartão" of the app, inline: preview, number/validade/CVC, name, billing CEP, default, consent, "Salvar cartão". */
function NewCardForm({ holderDefault, firstCard, onSaved, onCancel }: { holderDefault: string; firstCard: boolean; onSaved: (m: PaymentMethodView) => void; onCancel: (() => void) | null }) {
  const [f, setF] = useState({ number: '', exp: '', cvc: '', holder: holderDefault.toUpperCase(), cep: '', makeDefault: firstCard })
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const digits = f.number.replace(/\D/g, '')
  const brand = digits.length >= 2 ? brandOf(digits) : 'other'
  const check = checkCard({ number: f.number, exp: f.exp, cvc: f.cvc, holder: f.holder, cep: f.cep })
  const shown = error ?? (tried && !check.ok ? check.error : null)
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setError(null) }

  async function save() {
    setTried(true)
    if (!check.ok) return
    setBusy(true); setError(null)
    const res = await fetch('/api/collector/payment-methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: digits, exp: f.exp, cvc: f.cvc, holder: f.holder, cep: f.cep.replace(/\D/g, ''), makeDefault: f.makeDefault }) })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; method?: PaymentMethodView; error?: string }
    setBusy(false)
    if (!res.ok || !data.method) { setError(data.error ?? 'Não foi possível salvar o cartão.'); return }
    onSaved(data.method)
  }

  return (
    <div className="hc-newcard" role="group" aria-label="Adicionar cartão">
      <div className={`hc-card-preview hc-card-preview--${brand}`}>
        <div className="hc-card-preview__top"><span className="hc-card-preview__chip" /><span className="hc-card-preview__brand">{brand !== 'other' ? CARD_BRAND_LABELS[brand].toUpperCase() : ''}</span></div>
        <span className="hc-card-preview__num">{previewCardNumber(f.number, brand)}</span>
        <div className="hc-card-preview__foot"><span>{f.holder || 'NOME NO CARTÃO'}</span><span>{f.exp || 'MM/AA'}</span></div>
      </div>
      <div className="hc-field-group">
        <span className="hc-field-group__label">Informações do cartão</span>
        <div className={`hc-field-group__box${shown ? ' hc-field-group__box--error' : ''}`}>
          <div className="hc-field-group__row">
            <input value={f.number} onChange={(e) => set({ number: maskCardNumber(e.target.value, brandOf(e.target.value.replace(/\D/g, ''))) })} placeholder="1234 1234 1234 1234" inputMode="numeric" autoComplete="cc-number" aria-label="Número do cartão" />
            <span className="hc-field-group__brands">{(['visa', 'mastercard', 'amex', 'elo'] as const).map((b) => <span key={b} style={{ opacity: brand === 'other' || brand === b ? 1 : 0.25 }}><BrandChip brand={b} /></span>)}</span>
          </div>
          <div className="hc-field-group__row hc-field-group__row--split">
            <input value={f.exp} onChange={(e) => set({ exp: maskExpiry(e.target.value) })} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" aria-label="Validade" />
            <span className="hc-field-group__cvc"><input value={f.cvc} onChange={(e) => set({ cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" aria-label="Código de segurança" /><Icon name="credit_card" size={20} /></span>
          </div>
        </div>
        {shown ? <span className="ha-field-error hc-field-group__error" role="alert"><Icon name="error" size={16} />{shown}</span> : null}
      </div>
      <label className="hc-field-group">
        <span className="hc-field-group__label">Nome no cartão</span>
        <span className="hc-field-group__box"><input value={f.holder} onChange={(e) => set({ holder: e.target.value.toUpperCase() })} placeholder="Como está impresso" autoComplete="cc-name" className="hc-upper" /></span>
      </label>
      <div className="hc-field-group">
        <span className="hc-field-group__label">Endereço de cobrança</span>
        <div className="hc-field-group__box hc-field-group__row--split">
          <span className="hc-field-group__country">Brasil<Icon name="expand_more" size={20} /></span>
          <input value={f.cep} onChange={(e) => set({ cep: maskCep(e.target.value) })} placeholder="CEP" inputMode="numeric" autoComplete="postal-code" aria-label="CEP de cobrança" />
        </div>
      </div>
      <button type="button" className="hc-default" onClick={() => set({ makeDefault: !f.makeDefault })} aria-pressed={f.makeDefault}><Icon name={f.makeDefault ? 'check_box' : 'check_box_outline_blank'} size={22} />Usar como cartão padrão</button>
      <span className="hc-consent">Ao salvar, você autoriza a HouseArt a cobrar este cartão nas compras que confirmar, conforme os termos. Faremos uma pré-autorização de R$ 1,00, estornada na hora.</span>
      <button type="button" className="ha-btn ha-btn--ink ha-btn--md hc-cta" disabled={busy} aria-busy={busy || undefined} onClick={save}><Icon name="lock" size={18} />{busy ? 'Validando com o banco…' : 'Salvar cartão'}</button>
      <span className="hc-stripe">Processado com segurança pela <strong>Stripe</strong></span>
      {onCancel ? <button type="button" className="ha-link ha-link--quiet" onClick={onCancel}>Cancelar</button> : null}
    </div>
  )
}
