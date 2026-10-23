'use client'
// "Adicionar cartão" with Stripe Elements (test/live). Only shown when the
// server hands a publishable key (cardFormConfig); without it the screens keep
// the mock form. The card number, expiry and CVC are typed inside Stripe's
// iframe — they never touch HouseArt: the server opens a SetupIntent, Stripe.js
// confirms it here, and only the SetupIntent id goes back to be saved
// (brand/last4/expiry + the pm_ id).
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Field } from '@/components/ds/Field'
import type { PaymentMethodView } from '@/lib/payment-methods/domain'

interface StripeCardElement { mount(el: HTMLElement): void; destroy(): void; on(ev: 'change', fn: (e: { error?: { message: string }; complete: boolean }) => void): void }
interface StripeJs {
  elements(): { create(kind: 'card', opts: object): StripeCardElement }
  confirmCardSetup(secret: string, data: { payment_method: { card: StripeCardElement; billing_details: { name: string; address: { postal_code: string; country: 'BR' } } } }): Promise<{ setupIntent?: { id: string; status: string }; error?: { message?: string } }>
}
declare global { interface Window { Stripe?: (pk: string, opts?: { locale?: string }) => StripeJs } }

let loading: Promise<void> | null = null
/** Stripe.js only from js.stripe.com (PCI: never bundled, never self-hosted), loaded once on demand. */
function loadStripeJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if (window.Stripe) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; reject(new Error('stripe.js')) }
    document.head.appendChild(s)
  })
  return loading
}

export interface StripeCardFormProps {
  publishableKey: string
  holderDefault: string
  firstCard: boolean
  onSaved: (m: PaymentMethodView) => void
  onCancel?: (() => void) | null
}

export function StripeCardForm({ publishableKey, holderDefault, firstCard, onSaved, onCancel }: StripeCardFormProps) {
  const host = useRef<HTMLDivElement>(null)
  const stripe = useRef<StripeJs | null>(null)
  const card = useRef<StripeCardElement | null>(null)
  const [ready, setReady] = useState(false)
  const [complete, setComplete] = useState(false)
  const [holder, setHolder] = useState(holderDefault.toUpperCase())
  const [cep, setCep] = useState('')
  const [makeDefault, setMakeDefault] = useState(firstCard)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    loadStripeJs().then(() => {
      if (!alive || !host.current || !window.Stripe) return
      const s = window.Stripe(publishableKey, { locale: 'pt-BR' })
      // Elements live in an iframe: it cannot read our tokens, so it gets the computed values.
      const cs = getComputedStyle(host.current)
      const el = s.elements().create('card', { hidePostalCode: true, style: { base: { color: cs.color, fontFamily: cs.fontFamily, fontSize: cs.fontSize, '::placeholder': { color: cs.getPropertyValue('--ha-fg-muted').trim() || undefined } } } })
      el.mount(host.current)
      el.on('change', (e) => { setComplete(e.complete); setError(e.error?.message ?? null) })
      stripe.current = s; card.current = el
      setReady(true)
    }).catch(() => { if (alive) setError('Não foi possível carregar o formulário seguro do cartão. Verifique a conexão e recarregue a página.') })
    return () => { alive = false; card.current?.destroy(); card.current = null }
  }, [publishableKey])

  async function save() {
    const digits = cep.replace(/\D/g, '')
    if (!complete) { setError('Preencha os dados do cartão.'); return }
    if (!holder.trim()) { setError('Informe o nome impresso no cartão.'); return }
    if (digits.length !== 8) { setError('O CEP está incompleto.'); return }
    if (!stripe.current || !card.current) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/collector/payment-methods/setup', { method: 'POST' })
      const d = await r.json().catch(() => ({})) as { clientSecret?: string; error?: string }
      if (!r.ok || !d.clientSecret) { setError(d.error ?? 'Não foi possível iniciar o cadastro do cartão.'); return }
      const c = await stripe.current.confirmCardSetup(d.clientSecret, { payment_method: { card: card.current, billing_details: { name: holder.trim(), address: { postal_code: digits, country: 'BR' } } } })
      if (c.error || !c.setupIntent) { setError(c.error?.message ?? 'O cartão não foi aceito.'); return }
      const s = await fetch('/api/collector/payment-methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ setupIntentId: c.setupIntent.id, makeDefault }) })
      const sd = await s.json().catch(() => ({})) as { method?: PaymentMethodView; error?: string }
      if (!s.ok || !sd.method) { setError(sd.error ?? 'Não foi possível salvar o cartão.'); return }
      onSaved(sd.method)
    } finally { setBusy(false) }
  }

  return (
    <div className="ha-stack ha-stack--3" role="group" aria-label="Adicionar cartão">
      <div className="ha-label">
        Informações do cartão
        <div ref={host} className="ha-input" style={{ display: 'flex', alignItems: 'center', minHeight: 44 }} aria-busy={!ready || undefined} />
      </div>
      <Field label="Nome no cartão" value={holder} onChange={(e) => { setHolder(e.target.value.toUpperCase()); setError(null) }} placeholder="Como está impresso" autoComplete="cc-name" />
      <Field label="CEP de cobrança" value={cep} onChange={(e) => { setCep(e.target.value.replace(/[^\d-]/g, '').slice(0, 9)); setError(null) }} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" />
      <button type="button" className="ha-link ha-link--quiet" role="checkbox" aria-checked={makeDefault} onClick={() => setMakeDefault((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name={makeDefault ? 'check_box' : 'check_box_outline_blank'} size={22} />Usar como cartão padrão</button>
      {error ? <span className="ha-field-error" role="alert"><Icon name="error" size={16} />{error}</span> : null}
      <p className="ha-sm ha-muted" style={{ margin: 0 }}>Ao salvar, você autoriza a HouseArt a cobrar este cartão nas compras que confirmar, conforme os termos. O número do cartão vai direto para a Stripe; a HouseArt guarda só a bandeira e os 4 últimos dígitos.</p>
      <button type="button" className="ha-btn ha-btn--ink ha-btn--md" disabled={busy || !ready} aria-busy={busy || undefined} onClick={save}><Icon name="lock" size={18} />{busy ? 'Validando com o banco…' : 'Salvar cartão'}</button>
      <span className="ha-sm ha-muted">Processado com segurança pela <strong>Stripe</strong></span>
      {onCancel ? <button type="button" className="ha-link ha-link--quiet" onClick={onCancel}>Cancelar</button> : null}
    </div>
  )
}
