'use client'
// The web offer in five steps (handoff "HouseArt Oferta"): Valor · Identidade ·
// Garantia · Revisão, then the "Enviada" page (/e/offer/[code]). The rules
// live in offer-wizard-core.ts; this island renders, calls the existing APIs
// and keeps the draft in sessionStorage while the viewer goes to /login.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Button, ButtonLink } from '@/components/ds/Button'
import { Field } from '@/components/ds/Field'
import { formatBRL } from '@/lib/artworks/domain'
import { GUARANTEE_LABELS, brandOf, checkCard, CARD_BRAND_LABELS, type GuaranteeMethod, type PaymentMethodView } from '@/lib/payment-methods/domain'
import { StripeCardForm } from '@/components/wallet/StripeCardForm'
import { formatCep, insuranceCents, normalizeCep, ufFromCep } from '@/lib/shipping/quote-core'
import type { IdentityView } from '@/lib/accounts/identity-server'
import { OfferAside, type OfferArtwork } from './OfferFrame'
import {
  STEPS, type StepIndex, SHORTCUTS, SLIDER_STEP_CENTS, WIZARD_GUARANTEES, canAdvance, chanceOf, clampOffer, draftKey,
  formatCepInput, minOfferCents, reaisText, reviewRows, sellerWord, shortcutCents, typedCents, validityOptions,
} from './offer-wizard-core'

export interface WizardViewer { name: string; email: string; cpf: string | null }

interface Props { artwork: OfferArtwork; viewer: WizardViewer | null; identity: IdentityView | null }

type Draft = { step: StepIndex; offerCents: number; validityHours: number; message: string; guarantee: GuaranteeMethod; cep: string }

/** GET /api/public/shipping-quote for a full CEP; null when the CEP is not one. */
async function fetchShipping(publicId: string, rawCep: string, priceCents: number): Promise<{ cep: string; shippingCents: number } | null> {
  const n = normalizeCep(rawCep)
  if (!n || !ufFromCep(n)) return null
  const { ok, data } = await call<{ cep: string; shippingCents: string }>(`/api/public/shipping-quote?publicId=${encodeURIComponent(publicId)}&cep=${n}&priceCents=${priceCents}`)
  return ok ? { cep: data.cep, shippingCents: Number(data.shippingCents) } : null
}

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  return { ok: res.ok, status: res.status, data }
}

/** Reads the draft kept while the viewer went to /login (sessionStorage, per artwork). */
function readDraft(publicId: string, price: number, loggedIn: boolean): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(publicId))
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<Draft>
    const out: Partial<Draft> = {}
    if (typeof d.offerCents === 'number') out.offerCents = clampOffer(d.offerCents, price)
    if (typeof d.validityHours === 'number') out.validityHours = d.validityHours
    if (typeof d.message === 'string') out.message = d.message
    if (d.guarantee && (WIZARD_GUARANTEES as readonly string[]).includes(d.guarantee)) out.guarantee = d.guarantee
    if (typeof d.cep === 'string') out.cep = d.cep
    if (d.step && d.step >= 1 && d.step <= 4) out.step = (loggedIn ? d.step : Math.min(d.step, 2)) as StepIndex
    return out
  } catch { return null }
}

const noSubscribe = () => () => {}

/** The island mounts once without storage (SSR/hydration) and once more on the client with the draft read synchronously. */
export function OfferWizard(props: Props) {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const draft = mounted ? readDraft(props.artwork.publicId, props.artwork.priceCents, !!props.viewer) : null
  return <Wizard key={mounted ? 'client' : 'server'} {...props} draft={draft} />
}

function Wizard({ artwork, viewer, identity: initialIdentity, draft }: Props & { draft: Partial<Draft> | null }) {
  const price = artwork.priceCents
  const initialOffer = draft?.offerCents ?? clampOffer(price * 0.9, price)
  const [step, setStep] = useState<StepIndex>(draft?.step ?? 1)
  const [offerCents, setOfferCents] = useState(initialOffer)
  const [amountText, setAmountText] = useState(() => reaisText(initialOffer))
  const [validityHours, setValidityHours] = useState<number>(draft?.validityHours ?? 48)
  const [message, setMessage] = useState(draft?.message ?? '')
  const [identity, setIdentity] = useState<IdentityView | null>(initialIdentity)
  const [cpfDigits, setCpfDigits] = useState(viewer?.cpf ?? '')
  const [guarantee, setGuarantee] = useState<GuaranteeMethod>(draft?.guarantee ?? 'CARD_HOLD')
  const [cards, setCards] = useState<PaymentMethodView[] | null>(null)
  const [stripeCfg, setStripeCfg] = useState<{ publishableKey: string } | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const [cep, setCep] = useState(draft?.cep ?? '')
  const [shipping, setShipping] = useState<{ cep: string; shippingCents: number } | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otp, setOtp] = useState<{ code: string; value: string } | null>(null)

  // The draft survives the trip to /login (step 2 → "Entrar" → back here).
  useEffect(() => {
    try { window.sessionStorage.setItem(draftKey(artwork.publicId), JSON.stringify({ step, offerCents, validityHours, message, guarantee, cep } satisfies Draft)) } catch { /* ignore */ }
  }, [artwork.publicId, step, offerCents, validityHours, message, guarantee, cep])

  // Saved cards, once the viewer reaches the guarantee.
  useEffect(() => {
    if (!viewer || step !== 3 || cards !== null) return
    call<{ methods: PaymentMethodView[]; stripe?: { publishableKey: string } | null }>('/api/collector/payment-methods').then(({ ok, data }) => {
      const list = ok ? data.methods ?? [] : []
      setStripeCfg(ok ? data.stripe ?? null : null)
      setCards(list)
      setCardId((cur) => cur ?? (list.find((m) => m.isDefault) ?? list[0])?.id ?? null)
    })
  }, [viewer, step, cards])

  // The shipping quote follows the CEP (the API freezes it at the send); the insurance follows the offer by the same pure rule.
  async function requestQuote(rawCep: string) { setShipping(await fetchShipping(artwork.publicId, rawCep, offerCents)) }
  function changeCep(raw: string) {
    const v = formatCepInput(raw)
    setCep(v)
    if (v.replace(/\D/g, '').length === 8) void requestQuote(v); else setShipping(null)
  }
  useEffect(() => {
    if (!draft?.cep || draft.cep.replace(/\D/g, '').length !== 8) return
    fetchShipping(artwork.publicId, draft.cep, initialOffer).then((r) => { if (r) setShipping(r) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- the restored draft, once
  const quote = shipping ? { cep: shipping.cep, shippingCents: shipping.shippingCents, insuranceCents: insuranceCents(offerCents) } : null

  const identityState = { cpfOk: !!identity?.cpfMask, phoneOk: !!identity?.phoneVerified, emailOk: !!identity?.emailVerified }
  const hasCard = !!cardId
  const blocked = !canAdvance(step, { identity: identityState, accepted, guarantee, hasCard, loggedIn: !!viewer })
  const card = cards?.find((m) => m.id === cardId) ?? null

  function commitAmount(cents: number) { const v = clampOffer(cents, price); setOfferCents(v); setAmountText(reaisText(v)) }

  async function send() {
    if (!viewer || blocked || busy) return
    setBusy(true); setError(null)
    const doc = cpfDigits || viewer.cpf || ''
    const body = {
      publicId: artwork.publicId, buyerName: viewer.name, buyerEmail: viewer.email, buyerDocument: doc, buyerCity: identity?.city || undefined,
      offeredCents: offerCents, message: message.trim() || undefined, validityHours, guaranteeMethod: guarantee,
      paymentMethodId: guarantee === 'CARD_HOLD' && cardId ? cardId : undefined, deliveryCep: quote?.cep ?? undefined,
    }
    const { ok, data } = await call<{ code: string; confirmed: boolean; href?: string }>('/api/public/offers', { method: 'POST', body: JSON.stringify(body) })
    setBusy(false)
    if (!ok) { setError(data.error ?? 'Não foi possível enviar a oferta.'); return }
    try { window.sessionStorage.removeItem(draftKey(artwork.publicId)) } catch { /* ignore */ }
    if (data.confirmed && data.href) { window.location.assign(data.href); return }
    setOtp({ code: data.code, value: '' })
  }

  async function confirmOtp() {
    if (!otp || busy) return
    setBusy(true); setError(null)
    const { ok, data } = await call<{ href?: string }>(`/api/public/offers/${otp.code}/confirm`, { method: 'POST', body: JSON.stringify({ otp: otp.value }) })
    setBusy(false)
    if (!ok) { setError(data.error ?? 'Código inválido.'); return }
    window.location.assign(data.href ?? `/e/offer/${otp.code}`)
  }

  const next = () => { if (step === 4) void send(); else if (!blocked) { setError(null); setStep((s) => (s + 1) as StepIndex) } }
  const prev = () => { setError(null); setStep((s) => Math.max(1, s - 1) as StepIndex) }

  const destination = quote ? `o CEP ${formatCep(quote.cep)} (${ufFromCep(quote.cep) ?? '—'})` : null

  return (
    <div className="hp-offer" data-screen-label="Oferta">
      <main className="hp-offer__main">
        <ol className="hp-offer__steps" aria-label="Etapas da oferta">
          {STEPS.map((s, i) => {
            const n = i + 1
            const done = n < step, on = n === step
            return (
              <li key={s.key} className={`hp-offer__step${on ? ' hp-offer__step--on' : ''}${done ? ' hp-offer__step--done' : ''}`} aria-current={on ? 'step' : undefined}>
                <span className="hp-offer__step-bar" />
                <span className="hp-offer__step-name"><Icon name={done ? 'check_circle' : s.icon} size={16} /><span>{s.name}</span></span>
              </li>
            )
          })}
        </ol>

        {step === 1 ? (
          <section className="hp-offer__section" aria-labelledby="offer-step-1">
            <div className="hp-offer__head">
              <h1 id="offer-step-1" className="hp-offer__title">Quanto você quer oferecer?</h1>
              <span className="hp-offer__lead">{sellerWord(artwork.seller.kind).replace(/^./, (c) => c.toUpperCase())} responde em até {validityHours} horas. Você só é cobrado se a oferta for aceita.</span>
            </div>
            <div className="hp-offer__box">
              <label className="hp-offer__amount">
                <span className="hp-offer__amount-cur">R$</span>
                <input className="hp-offer__amount-input" inputMode="numeric" aria-label="Valor da oferta" value={amountText}
                  onChange={(e) => { const c = typedCents(e.target.value, price); setAmountText(e.target.value.replace(/[^\d.]/g, '')); setOfferCents(c) }}
                  onBlur={() => commitAmount(offerCents)} />
              </label>
              <input className="hp-offer__range" type="range" min={minOfferCents(price)} max={price} step={SLIDER_STEP_CENTS} value={Math.max(minOfferCents(price), offerCents)} aria-label="Ajustar valor" onChange={(e) => commitAmount(Number(e.target.value))} />
              <div className="hp-offer__bounds"><span>{formatBRL(minOfferCents(price))}</span><span>Preço pedido {formatBRL(price)}</span></div>
              <div className="hp-offer__shortcuts">
                {SHORTCUTS.map((f) => { const c = shortcutCents(price, f); return <button key={f} type="button" className="hp-offer__shortcut" aria-pressed={offerCents === c} onClick={() => commitAmount(c)}>−{Math.round((1 - f) * 100)}% · {formatBRL(c)}</button> })}
              </div>
              {(() => { const ch = chanceOf(offerCents, price, artwork.seller.kind); return (
                <div className={`hp-offer__chance hp-offer__chance--${ch.tone}`} role="status">
                  <Icon name={ch.icon} size={22} />
                  <div className="hp-offer__chance-text"><b>{ch.title}</b><span>{ch.text}</span></div>
                </div>
              ) })()}
            </div>
            <div className="hp-offer__group">
              <span className="hp-offer__group-title">Validade da oferta</span>
              <div className="hp-offer__validities" role="group" aria-label="Validade da oferta">
                {validityOptions(artwork.seller.kind).map((v) => <button key={v.hours} type="button" className="hp-offer__validity" aria-pressed={validityHours === v.hours} onClick={() => setValidityHours(v.hours)}><b>{v.name}</b><span>{v.sub}</span></button>)}
              </div>
            </div>
            <label className="hp-offer__message">
              <span className="hp-offer__group-title">Mensagem para {sellerWord(artwork.seller.kind)} <small>(opcional)</small></span>
              <textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte por que essa obra é importante para você ou combine detalhes da entrega." />
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="hp-offer__section hp-offer__section--tight" aria-labelledby="offer-step-2">
            <div className="hp-offer__head">
              <h1 id="offer-step-2" className="hp-offer__title">Confirme sua identidade</h1>
              <span className="hp-offer__lead">Ofertas só são enviadas por compradores verificados. Isso protege você, {sellerWord(artwork.seller.kind)} e o artista.</span>
            </div>
            {viewer ? (
              <IdentityChecks identity={identity} viewer={viewer} onIdentity={setIdentity} onCpf={setCpfDigits} />
            ) : (
              <div className="hp-offer__login">
                <b>Entre ou crie sua conta</b>
                <p>Sua oferta fica guardada aqui enquanto você entra. A conta leva um minuto: e-mail, celular e CPF confirmados uma vez só.</p>
                <div className="hp-offer__login-actions">
                  <ButtonLink href={`/login?next=${encodeURIComponent(`/e/artwork/${artwork.publicId}/offer`)}`} variant="ink" size="sm">Entrar</ButtonLink>
                  <ButtonLink href={`/signup?next=${encodeURIComponent(`/e/artwork/${artwork.publicId}/offer`)}`} variant="outline" size="sm">Criar conta</ButtonLink>
                </div>
              </div>
            )}
            <span className="hp-offer__note"><Icon name="shield_person" size={16} />Seus dados ficam protegidos conforme a LGPD. {artwork.seller.kind === 'GALLERY' ? 'A galeria' : 'O vendedor'} vê apenas seu nome e cidade.</span>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="hp-offer__section hp-offer__section--tight" aria-labelledby="offer-step-3">
            <div className="hp-offer__head">
              <h1 id="offer-step-3" className="hp-offer__title">Garantia da oferta</h1>
              <span className="hp-offer__lead">Reservamos o valor sem cobrar. Se {sellerWord(artwork.seller.kind)} recusar ou a oferta expirar, a reserva é desfeita na hora.</span>
            </div>
            <div className="hp-offer__methods" role="radiogroup" aria-label="Método de garantia">
              {WIZARD_GUARANTEES.map((m) => {
                const l = GUARANTEE_LABELS[m]
                const sub = m === 'CARD_HOLD' && card ? `${card.brandLabel} final ${card.last4} · o valor é reservado, não cobrado` : l.sub
                return (
                  <button key={m} type="button" role="radio" aria-checked={guarantee === m} className="hp-offer__method" onClick={() => setGuarantee(m)}>
                    <span className="hp-offer__radio" /><Icon name={l.icon} size={24} />
                    <span className="hp-offer__method-text"><b>{l.name}</b><span>{sub}</span></span>
                  </button>
                )
              })}
            </div>
            {guarantee === 'CARD_HOLD' ? <CardPicker cards={cards} cardId={cardId} onPick={setCardId} stripe={stripeCfg} holderDefault={viewer?.name ?? ''} onAdded={(m) => { setCards((cs) => [...(cs ?? []).filter((c) => c.id !== m.id), m]); setCardId(m.id) }} /> : null}
            <div className="hp-offer__group">
              <span className="hp-offer__group-title">Entrega</span>
              <div className="hp-offer__cep">
                <Field label="CEP de entrega" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => changeCep(e.target.value)} hint={quote ? `Frete ${formatBRL(quote.shippingCents)} · seguro ${formatBRL(quote.insuranceCents)}` : 'Frete especializado e seguro são calculados pelo CEP.'} />
              </div>
            </div>
            <div className="hp-offer__lock"><Icon name="lock" size={20} />Se aceita, o pagamento fica em garantia e só é liberado {artwork.seller.kind === 'GALLERY' ? 'à galeria' : 'ao vendedor'} depois que você confirmar o recebimento pela etiqueta da obra.</div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="hp-offer__section hp-offer__section--tight" aria-labelledby="offer-step-4">
            <h1 id="offer-step-4" className="hp-offer__title">Revise e envie</h1>
            <dl className="hp-offer__review">
              {reviewRows({ offerCents, validityHours, message, guarantee, cardLabel: card ? `${card.brandLabel} final ${card.last4}` : null }).map((r) => (
                <div key={r.key} className="hp-offer__review-row">
                  <dt>{r.key}</dt>
                  <dd>{r.value}<button type="button" className="hp-offer__edit" onClick={() => { setOtp(null); setStep(r.step) }}>Editar</button></dd>
                </div>
              ))}
              <div className="hp-offer__review-row"><dt>Entrega</dt><dd>{quote ? `CEP ${formatCep(quote.cep)} · frete ${formatBRL(quote.shippingCents)} + seguro ${formatBRL(quote.insuranceCents)}` : 'Sem CEP · a combinar'}<button type="button" className="hp-offer__edit" onClick={() => setStep(3)}>Editar</button></dd></div>
            </dl>
            {otp ? (
              <div className="hp-offer__otp" role="region" aria-label="Confirmação por código">
                <b>Confirme pelo código do e-mail</b>
                <span className="ha-sm">Enviamos um código de 6 dígitos para <b>{viewer?.email}</b>. A oferta <b>{otp.code}</b> só é registrada depois dele.</span>
                <div className="hp-offer__otp-row">
                  <Field label="Código" inputMode="numeric" maxLength={6} value={otp.value} onChange={(e) => setOtp({ ...otp, value: e.target.value.replace(/\D/g, '') })} id />
                  <Button variant="primary" size="sm" loading={busy} disabled={otp.value.length < 6} onClick={() => void confirmOtp()}>Confirmar oferta</Button>
                </div>
              </div>
            ) : (
              <label className="hp-offer__accept">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                Entendo que esta oferta é vinculante: se {sellerWord(artwork.seller.kind)} aceitar dentro da validade, a compra é concluída automaticamente com o método de garantia escolhido.
              </label>
            )}
          </section>
        ) : null}

        {error ? <p className="hp-offer__error" role="alert">{error}</p> : null}

        {otp ? null : (
          <div className="hp-offer__nav">
            <button type="button" className={`hp-offer__prev${step === 1 ? ' hp-offer__prev--hidden' : ''}`} aria-hidden={step === 1 || undefined} tabIndex={step === 1 ? -1 : undefined} onClick={prev}><Icon name="arrow_back" size={20} />Voltar</button>
            <button type="button" className={`hp-offer__next${step === 4 ? ' hp-offer__next--send' : ''}`} disabled={blocked || busy} onClick={next} aria-busy={busy || undefined}>
              {step === 4 ? `Enviar oferta de ${formatBRL(offerCents)}` : 'Continuar'}<Icon name="arrow_forward" size={20} />
            </button>
          </div>
        )}
      </main>
      <OfferAside artwork={artwork} summary={{ offerCents, shippingCents: quote?.shippingCents ?? 0, insuranceCents: quote?.insuranceCents ?? 0, destination }} />
    </div>
  )
}

// ── step 2: the three checks ─────────────────────────────────────────────────
function CheckItem({ ok, icon, name, sub, action, open, onOpen, children }: { ok: boolean; icon: string; name: string; sub: string; action?: string; open?: boolean; onOpen?: () => void; children?: React.ReactNode }) {
  return (
    <div className={`hp-offer__item${ok ? ' hp-offer__item--ok' : ''}`}>
      <span className="hp-offer__item-icon"><Icon name={ok ? 'check' : icon} size={22} /></span>
      <div className="hp-offer__item-text"><b>{name}</b><span>{sub}</span></div>
      {ok ? <span className="hp-offer__item-ok">Verificado</span> : action && !open ? <Button variant="ink" size="sm" onClick={onOpen}>{action}</Button> : null}
      {!ok && open ? children : null}
    </div>
  )
}

function IdentityChecks({ identity, viewer, onIdentity, onCpf }: { identity: IdentityView | null; viewer: WizardViewer; onIdentity: (i: IdentityView) => void; onCpf: (digits: string) => void }) {
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState(identity?.city ?? '')
  const [cpfBusy, setCpfBusy] = useState(false)
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [cpfOpen, setCpfOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [sms, setSms] = useState<{ token: string; mask: string; echo?: string } | null>(null)
  const [code, setCode] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const cpfOk = !!identity?.cpfMask
  const phoneOk = !!identity?.phoneVerified
  const emailOk = !!identity?.emailVerified

  async function saveCpf() {
    setCpfBusy(true); setCpfError(null)
    const { ok, data } = await call<{ identity: IdentityView }>('/api/auth/identity', { method: 'PATCH', body: JSON.stringify({ cpf, city: city || undefined }) })
    setCpfBusy(false)
    if (!ok) { setCpfError(data.error ?? 'Não foi possível confirmar o CPF.'); return }
    onIdentity(data.identity); onCpf(cpf.replace(/\D/g, '')); setCpfOpen(false)
  }
  async function startPhone() {
    setPhoneBusy(true); setPhoneError(null)
    const { ok, data } = await call<{ token: string; phoneMask: string; echo?: string }>('/api/auth/phone/start', { method: 'POST', body: JSON.stringify({ phone }) })
    setPhoneBusy(false)
    if (!ok) { setPhoneError(data.error ?? 'Não foi possível enviar o código.'); return }
    setSms({ token: data.token, mask: data.phoneMask, echo: data.echo })
  }
  async function verifyPhone() {
    if (!sms) return
    setPhoneBusy(true); setPhoneError(null)
    const { ok, data } = await call<{ ok: boolean }>('/api/auth/phone/verify', { method: 'POST', body: JSON.stringify({ token: sms.token, code }) })
    setPhoneBusy(false)
    if (!ok) { setPhoneError(data.error ?? 'Código inválido.'); return }
    const id = await call<{ identity: IdentityView }>('/api/auth/identity')
    if (id.ok) onIdentity(id.data.identity)
    setPhoneOpen(false); setSms(null)
  }

  return (
    <div className="hp-offer__list">
      <CheckItem ok={cpfOk} icon="badge" name="CPF e dados pessoais" sub={cpfOk ? `${identity?.name ?? viewer.name} · ${identity?.cpfMask}` : `${viewer.name} · informe o CPF do titular da oferta`} action="Confirmar" open={cpfOpen} onOpen={() => setCpfOpen(true)}>
        <form className="hp-offer__item-form" onSubmit={(e) => { e.preventDefault(); void saveCpf() }}>
          <Field label="CPF" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} error={cpfError ?? undefined} />
          <Field label="Cidade/UF" placeholder="Salvador/BA" value={city} onChange={(e) => setCity(e.target.value)} />
          <Button variant="ink" size="sm" type="submit" loading={cpfBusy} disabled={cpf.replace(/\D/g, '').length !== 11}>Confirmar</Button>
        </form>
      </CheckItem>
      <CheckItem ok={phoneOk} icon="smartphone" name={phoneOk ? 'Celular confirmado' : 'Celular'} sub={phoneOk ? `Confirmado por SMS em ${identity?.phoneMask}` : sms ? `Código enviado por SMS para ${sms.mask}` : 'Enviamos um código por SMS para confirmar o número'} action="Confirmar" open={phoneOpen} onOpen={() => setPhoneOpen(true)}>
        {sms ? (
          <form className="hp-offer__item-form" onSubmit={(e) => { e.preventDefault(); void verifyPhone() }}>
            <Field label="Código do SMS" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={phoneError ?? undefined} hint={sms.echo ? <span className="hp-offer__echo">Ambiente de teste · código {sms.echo}</span> : undefined} id />
            <Button variant="ink" size="sm" type="submit" loading={phoneBusy} disabled={code.length < 6}>Confirmar</Button>
            <Button variant="ghost" size="sm" onClick={() => { setSms(null); setCode('') }}>Trocar número</Button>
          </form>
        ) : (
          <form className="hp-offer__item-form" onSubmit={(e) => { e.preventDefault(); void startPhone() }}>
            <Field label="Celular com DDD" inputMode="tel" autoComplete="tel" placeholder="(71) 99999-0000" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError ?? undefined} />
            <Button variant="ink" size="sm" type="submit" loading={phoneBusy} disabled={phone.replace(/\D/g, '').length < 10}>Enviar código</Button>
          </form>
        )}
      </CheckItem>
      <CheckItem ok={emailOk} icon="mail" name={emailOk ? 'E-mail confirmado' : 'E-mail'} sub={emailOk ? `${viewer.email} · confirmado pela sua conta` : `Código de 6 dígitos enviado para ${viewer.email} no envio da oferta`} />
    </div>
  )
}

// ── step 3: the saved card or a new one ──────────────────────────────────────
function CardPicker({ cards, cardId, onPick, onAdded, stripe = null, holderDefault = '' }: { cards: PaymentMethodView[] | null; cardId: number | null; onPick: (id: number) => void; onAdded: (m: PaymentMethodView) => void; stripe?: { publishableKey: string } | null; holderDefault?: string }) {
  const [addingState, setAdding] = useState(false)
  const [form, setForm] = useState({ number: '', exp: '', cvc: '', holder: '', cep: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = form.number.replace(/\D/g, '')
  const brand = digits.length >= 4 ? CARD_BRAND_LABELS[brandOf(digits)] : null
  const adding = addingState || (cards !== null && cards.length === 0)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const check = checkCard(form)
    if (!check.ok) { setError(check.error); return }
    setBusy(true); setError(null)
    const { ok, data } = await call<{ method: PaymentMethodView }>('/api/collector/payment-methods', { method: 'POST', body: JSON.stringify({ ...form, makeDefault: !cards?.length }) })
    setBusy(false)
    if (!ok) { setError(data.error ?? 'Não foi possível guardar o cartão.'); return }
    onAdded(data.method); setAdding(false); setForm({ number: '', exp: '', cvc: '', holder: '', cep: '' })
  }

  if (cards === null) return <div className="hp-offer__card"><span className="ha-sm ha-muted">Carregando seus cartões…</span></div>
  return (
    <div className="hp-offer__card">
      {cards.length ? (
        <div className="hp-offer__card-row" role="radiogroup" aria-label="Cartão da pré-autorização">
          <Icon name="credit_card" size={20} />
          {cards.length === 1 ? <b>{cards[0].label} · {cards[0].exp}</b> : (
            <select className="ha-select" value={cardId ?? ''} onChange={(e) => onPick(Number(e.target.value))} aria-label="Cartão">
              {cards.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.exp}{m.isDefault ? ' · padrão' : ''}</option>)}
            </select>
          )}
          {!adding ? <button type="button" className="hp-offer__edit" onClick={() => setAdding(true)}>Adicionar cartão</button> : null}
        </div>
      ) : <span className="ha-sm">Nenhum cartão guardado. Adicione um para reservar o valor — nada é cobrado agora.</span>}
      {adding && stripe ? (
        <StripeCardForm publishableKey={stripe.publishableKey} holderDefault={holderDefault} firstCard={!cards.length} onSaved={(m) => { onAdded(m); setAdding(false) }} onCancel={cards.length ? () => setAdding(false) : null} />
      ) : adding ? (
        <form className="hp-offer__card-grid" onSubmit={save}>
          <Field label={<>Número do cartão{brand ? <small className="ha-muted"> · {brand}</small> : null}</>} inputMode="numeric" autoComplete="cc-number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} />
          <Field label="Validade (MM/AA)" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) })} />
          <Field label="CVC" inputMode="numeric" autoComplete="cc-csc" value={form.cvc} onChange={(e) => setForm({ ...form, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          <Field label="Nome impresso" autoComplete="cc-name" value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} />
          <Field label="CEP da fatura" inputMode="numeric" autoComplete="billing postal-code" value={form.cep} onChange={(e) => setForm({ ...form, cep: formatCepInput(e.target.value) })} />
          {error ? <span className="ha-field-error" role="alert" style={{ gridColumn: 'span 6' }}>{error}</span> : null}
          <div className="hp-offer__card-row" style={{ gridColumn: 'span 6' }}>
            <Button variant="ink" size="sm" type="submit" loading={busy}>Guardar cartão</Button>
            {cards.length ? <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button> : null}
          </div>
        </form>
      ) : null}
    </div>
  )
}
