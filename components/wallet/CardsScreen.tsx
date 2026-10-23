'use client'
// Carteira e cartões (handoff "HouseArt App Colecionador" › carteira + sheet
// cartao). Big default card + saved list (expand → tornar padrão / remover) and
// the "Adicionar cartão" sheet with the six messages of the prototype, in order.
import { useCallback, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { brandOf, checkCard, CARD_BRAND_LABELS, type CardBrand, type PaymentMethodView } from '@/lib/payment-methods/domain'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { StripeCardForm } from './StripeCardForm'
import { brandMark, cardPreviewNumber, EMPTY_CARD_FORM, expiresSoon, expiryForApi, formatCardNumber, formatCep, formatCvc, formatExpiry, maskedNumber, type NewCardForm } from './cards-core'

const MARKS: CardBrand[] = ['visa', 'mastercard', 'amex', 'elo']

function BrandMark({ brand, size = 'md', dim = false }: { brand: CardBrand; size?: 'md' | 'xs'; dim?: boolean }) {
  const cls = ['ha-cards-mark', `ha-cards-mark--${brand}`, size === 'xs' ? 'ha-cards-mark--xs' : '', dim ? 'ha-cards-mark--dim' : ''].filter(Boolean).join(' ')
  if (brand === 'mastercard') return <span className={cls} aria-label="Mastercard"><span className="ha-cards-mark__mc"><span /><span /></span></span>
  const txt = brand === 'elo' ? 'elo' : brand === 'hipercard' ? 'Hiper' : brandMark(brand)
  return <span className={cls} aria-label={CARD_BRAND_LABELS[brand]}>{brand === 'other' ? <Icon name="credit_card" size={16} /> : txt}</span>
}

function CardFace({ brand, number, holder, exp, tag, small }: { brand: CardBrand; number: string; holder: string; exp: string; tag?: string; small?: boolean }) {
  return (
    <div className={`ha-cards-face ha-cards-face--${brand}${small ? ' ha-cards-face--sm' : ''}`} aria-hidden="true">
      {small ? null : <span className="ha-cards-face__ring" />}
      {small ? (
        <div className="ha-cards-face__top"><span className="ha-cards-face__chip" /><span className="ha-cards-face__mark">{brandMark(brand)}</span></div>
      ) : (
        <div className="ha-cards-face__top"><HouseArtLogo version="simples_horiz" tone="negativo" height={20} />{tag ? <span className="ha-cards-face__tag">{tag}</span> : null}</div>
      )}
      {small ? null : <span className="ha-cards-face__chip" />}
      <span className="ha-cards-face__num">{number}</span>
      {small ? (
        <div className="ha-cards-face__names"><span>{holder || 'NOME NO CARTÃO'}</span><span>{exp || 'MM/AA'}</span></div>
      ) : (
        <div className="ha-cards-face__bottom">
          <span className="ha-cards-face__kv"><span className="ha-cards-face__k">TITULAR</span><span className="ha-cards-face__v">{holder}</span></span>
          <span className="ha-cards-face__kv ha-cards-face__kv--end"><span className="ha-cards-face__k">VALIDADE</span><span className="ha-cards-face__v">{exp}</span></span>
          <span className="ha-cards-face__mark">{brandMark(brand)}</span>
        </div>
      )}
    </div>
  )
}

/** `stripe` (test/live): the sheet is Stripe Elements; null keeps the mock form of the prototype. */
export function CardsScreen({ methods: initial, holderName, payout, stripe = null }: { methods: PaymentMethodView[]; holderName: string; payout: { href: string; registered: boolean } | null; stripe?: { publishableKey: string } | null }) {
  const [methods, setMethods] = useState(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState<NewCardForm>({ ...EMPTY_CARD_FORM, holder: holderName.toUpperCase() })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const pad = methods.find((m) => m.isDefault) ?? methods[0]
  const digits = form.number.replace(/\D/g, '')
  const typedBrand = digits ? brandOf(digits) : null

  const set = (p: Partial<NewCardForm>) => { setForm((f) => ({ ...f, ...p })); setError('') }
  const on = (k: keyof NewCardForm, fmt: (v: string) => string) => (e: ChangeEvent<HTMLInputElement>) => set({ [k]: fmt(e.target.value) })

  function openSheet() {
    setForm({ ...EMPTY_CARD_FORM, holder: holderName.toUpperCase(), makeDefault: methods.length === 0 })
    setError('')
    setSheet(true)
  }

  async function save() {
    const check = checkCard({ number: form.number, exp: expiryForApi(form.exp), cvc: form.cvc, holder: form.holder, cep: form.cep })
    if (!check.ok) { setError(check.error); return }
    setSaving(true)
    const res = await fetch('/api/collector/payment-methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: form.number, exp: expiryForApi(form.exp), cvc: form.cvc, holder: form.holder, cep: form.cep, makeDefault: form.makeDefault }) })
    const data = await res.json().catch(() => ({})) as { method?: PaymentMethodView; error?: string }
    setSaving(false)
    if (!res.ok || !data.method) { setError(data.error ?? 'Não foi possível salvar o cartão.'); return }
    added(data.method)
  }

  function added(novo: PaymentMethodView) {
    setMethods((ms0) => { const ms = ms0.filter((m) => m.id !== novo.id); return [...(novo.isDefault ? ms.map((m) => ({ ...m, isDefault: false })) : ms), novo].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id) })
    setSheet(false)
    setToast(`${novo.label} salvo na carteira`)
  }

  async function makeDefault(id: number) {
    const res = await fetch(`/api/collector/payment-methods/${id}`, { method: 'PATCH' })
    if (!res.ok) { setToast('Não foi possível atualizar o cartão padrão.'); return }
    setMethods((ms) => ms.map((m) => ({ ...m, isDefault: m.id === id })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id))
    setToast('Cartão padrão atualizado')
  }

  async function remove(id: number) {
    const res = await fetch(`/api/collector/payment-methods/${id}`, { method: 'DELETE' })
    if (!res.ok) { setToast('Não foi possível remover o cartão.'); return }
    setMethods((ms) => {
      const rest = ms.filter((m) => m.id !== id)
      if (rest.length && !rest.some((m) => m.isDefault)) rest[0] = { ...rest[0], isDefault: true }
      return rest
    })
    setOpen(null)
    setToast('Cartão removido')
  }

  return (
    <div className="ha-cards">
      <section className="ha-cards__col">
        {pad ? (
          <CardFace brand={pad.brand} number={maskedNumber(pad.last4)} holder={pad.holderName} exp={pad.exp} tag="Padrão" />
        ) : (
          <div className="ha-card ha-card--pad ha-stack ha-stack--3">
            <span className="ha-cards-empty">Nenhum cartão salvo.</span>
            <p className="ha-sm ha-muted" style={{ margin: 0 }}>Um cartão salvo deixa a compra direta e a pré-autorização das ofertas prontas em um toque.</p>
          </div>
        )}
        {payout ? (
          <div className="ha-stack ha-stack--3">
            <h2 className="ha-cards__title">Recebimentos das vendas</h2>
            <Link href={payout.href} className={`ha-cards-payout${payout.registered ? ' ha-cards-payout--on' : ''}`}>
              <span className="ha-cards-payout__ic"><Icon name="account_balance" size={20} /></span>
              <span className="ha-stack">
                <span className="ha-cards-payout__t">{payout.registered ? 'Pix para receber vendas' : 'Cadastrar chave Pix'}</span>
                <span className="ha-cards-payout__s">{payout.registered ? 'Cadastrado · repasse em até 1 dia útil após a entrega' : 'Obrigatório para receber o valor das suas vendas'}</span>
              </span>
              <Icon name="chevron_right" size={20} />
            </Link>
          </div>
        ) : null}
        <span className="ha-cards-note"><Icon name="lock" size={16} />Pagamentos processados pela Stripe, com certificação PCI DSS. A HouseArt não guarda o número do seu cartão.</span>
      </section>

      <section className="ha-cards__col">
        <h2 className="ha-cards__title">Cartões</h2>
        <div className="ha-cards-list">
          {methods.map((m) => {
            const ab = open === m.id
            const soon = expiresSoon(m.exp)
            return (
              <div key={m.id} className={`ha-cards-item${ab ? ' ha-cards-item--open' : ''}`}>
                <button type="button" className="ha-cards-item__head" aria-expanded={ab} onClick={() => setOpen(ab ? null : m.id)}>
                  <BrandMark brand={m.brand} />
                  <span className="ha-stack">
                    <span className="ha-cards-item__name">{m.label}{m.isDefault ? <span className="ha-cards-item__default">Padrão</span> : null}</span>
                    <span className={`ha-cards-item__sub${soon ? ' ha-cards-item__sub--soon' : ''}`}>Vence {m.exp}{soon ? ' · vence em breve' : ''}</span>
                  </span>
                  <Icon name={ab ? 'expand_less' : 'expand_more'} size={22} className="ha-cards-item__chev" />
                </button>
                {ab ? (
                  <div className="ha-cards-item__actions">
                    <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={m.isDefault} style={m.isDefault ? { opacity: .5 } : undefined} onClick={() => makeDefault(m.id)}>{m.isDefault ? 'Já é o padrão' : 'Tornar padrão'}</button>
                    <button type="button" className="ha-cards-item__remove" onClick={() => remove(m.id)}>Remover</button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {methods.length === 0 ? <span className="ha-cards-empty">Nenhum cartão salvo.</span> : null}
          <button type="button" className="ha-cards-add" onClick={openSheet}><Icon name="add_card" size={20} />Adicionar cartão</button>
        </div>
      </section>

      {stripe ? (
        <Modal open={sheet} title="Adicionar cartão" onClose={() => setSheet(false)}>
          {sheet ? <StripeCardForm publishableKey={stripe.publishableKey} holderDefault={holderName} firstCard={methods.length === 0} onSaved={added} /> : null}
        </Modal>
      ) : (
      <Modal open={sheet} title="Adicionar cartão" onClose={() => (saving ? null : setSheet(false))} footer={
        <div className="ha-cards-foot">
          <button type="button" className="ha-btn ha-btn--ink ha-btn--md" disabled={saving} onClick={save}><Icon name="lock" size={18} />{saving ? 'Validando com o banco…' : 'Salvar cartão'}</button>
          <span className="ha-cards-foot__by">Processado com segurança pela <strong>Stripe</strong></span>
        </div>
      }>
        <div className="ha-cards-form">
          <CardFace small brand={typedBrand ?? 'other'} number={cardPreviewNumber(form.number)} holder={form.holder} exp={form.exp} />
          <div className="ha-cards-form__label">
            Informações do cartão
            <div className={`ha-cards-group${error ? ' ha-cards-group--error' : ''}`}>
              <div className="ha-cards-group__row">
                <input className="ha-cards-group__in" value={form.number} onChange={on('number', formatCardNumber)} placeholder="1234 1234 1234 1234" inputMode="numeric" autoComplete="cc-number" aria-label="Número do cartão" />
                <span className="ha-cards-group__marks">{MARKS.map((k) => <BrandMark key={k} brand={k} size="xs" dim={!!typedBrand && typedBrand !== k} />)}</span>
              </div>
              <div className="ha-cards-group__row ha-cards-group__half">
                <div className="ha-cards-group__cell"><input className="ha-cards-group__in" value={form.exp} onChange={on('exp', formatExpiry)} placeholder="MM / AA" inputMode="numeric" autoComplete="cc-exp" aria-label="Validade" /></div>
                <div className="ha-cards-group__cell"><input className="ha-cards-group__in" value={form.cvc} onChange={on('cvc', formatCvc)} placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" aria-label="Código de segurança" /><Icon name="credit_card" size={20} className="ha-cards-group__ic" /></div>
              </div>
            </div>
            {error ? <span className="ha-cards-error" role="alert"><Icon name="error" size={16} />{error}</span> : null}
          </div>
          <label className="ha-cards-form__label">
            Nome no cartão
            <span className="ha-cards-group"><span className="ha-cards-group__row"><input className="ha-cards-group__in ha-cards-group__in--upper" value={form.holder} onChange={on('holder', (v) => v.toUpperCase())} placeholder="Como está impresso" autoComplete="cc-name" /></span></span>
          </label>
          <div className="ha-cards-form__label">
            Endereço de cobrança
            <div className="ha-cards-group"><div className="ha-cards-group__row ha-cards-group__half">
              <span className="ha-cards-group__cell ha-cards-group__cell--static">Brasil<Icon name="expand_more" size={20} /></span>
              <span className="ha-cards-group__cell"><input className="ha-cards-group__in" value={form.cep} onChange={on('cep', formatCep)} placeholder="CEP" inputMode="numeric" autoComplete="postal-code" aria-label="CEP de cobrança" /></span>
            </div></div>
          </div>
          <button type="button" className="ha-cards-check" role="checkbox" aria-checked={form.makeDefault} onClick={() => set({ makeDefault: !form.makeDefault })}><Icon name={form.makeDefault ? 'check_box' : 'check_box_outline_blank'} size={22} />Usar como cartão padrão</button>
          <p className="ha-cards-fine">Ao salvar, você autoriza a HouseArt a cobrar este cartão nas compras que confirmar, conforme os termos. Faremos uma pré-autorização de R$ 1,00, estornada na hora.</p>
        </div>
      </Modal>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
