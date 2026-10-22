'use client'
// The signup island: the "Criar sua conta" card of HouseArt Cadastro.dc.html
// (step 1) followed by the stepped flow of the "Cadastro" shortcut of
// HouseArt App Colecionador.dc.html — e-mail code → phone code by SMS →
// how you will use it / interests / city / newsletter → "Conta criada".
// `startAt` = 3 is the continuation of a social signup (/signup/welcome).
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Icon, Toggle } from '@/components/ds'
import { ProviderMark } from './ProviderMark'
import { PROFILE_CARDS } from '@/lib/profiles/core'
import { formatPhoneInput, normalizeBrMobile } from '@/lib/sms/core'
import { INTEREST_LABELS, PREFERENCE_INTERESTS, PREFERENCE_USES, USE_LABELS } from '@/lib/accounts/preferences-core'
import { useSignupPlan } from './SignupPlanContext'
import type { SignupProfileKind } from './signup-plans'

export type SignupStep = 1 | 2 | 3 | 4 | 5

const SELF_SIGNUP: readonly SignupProfileKind[] = ['ARTIST', 'GALLERY', 'COLLECTOR', 'ADVISOR']

/** Social buttons in the order of the prototypes (Cadastro: Google, Apple, LinkedIn; the app adds Facebook). */
const SOCIAL = [
  { key: 'GOOGLE', slug: 'google', name: 'Google' },
  { key: 'APPLE', slug: 'apple', name: 'Apple' },
  { key: 'FACEBOOK', slug: 'facebook', name: 'Facebook' },
  { key: 'LINKEDIN', slug: 'linkedin', name: 'LinkedIn' },
] as const

const SOCIAL_NOTICE: Record<string, string> = {
  'no-account': 'Não encontramos conta para esse login. Crie a conta abaixo.',
  state: 'Não conseguimos confirmar o login social. Tente de novo.',
  denied: 'Você não autorizou o acesso no provedor. Tente de novo ou use o e-mail.',
  failed: 'O provedor não respondeu. Tente de novo em instantes.',
  'no-email': 'O provedor não informou um e-mail. Use outro provedor ou cadastre-se com e-mail.',
  inactive: 'Essa conta está desativada. Fale com a equipe HouseArt.',
  provider: 'Esse provedor não está disponível no momento.',
}

const USE_ICONS: Record<(typeof PREFERENCE_USES)[number], string> = { COLLECT: 'account_balance_wallet', SELL: 'sell', APPRAISE: 'query_stats', DISCOVER: 'groups', MANAGE_GALLERY: 'storefront' }

const STEP_TITLES: Record<SignupStep, [string, string]> = {
  1: ['Criar sua conta', ''],
  2: ['Confirme seu e-mail', 'Enviamos um código de 6 dígitos. É assim que protegemos a sua conta.'],
  3: ['Confirme seu celular', 'Usamos o celular para confirmar a conta e avisar sobre propostas e entregas.'],
  4: ['Como você vai usar a HouseArt?', 'Pode escolher mais de um. Isso ajusta o que aparece no seu feed.'],
  5: ['', 'Sua coleção, suas propostas e a comunidade já estão prontas.'],
}

interface Props {
  providers: string[]
  startAt?: SignupStep
  social?: string | null
  socialProvider?: string | null
  /** Known account (the social continuation): fills the "Conta criada" summary. */
  account?: { name: string; email: string } | null
}

async function post(url: string, body: unknown, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; token?: string; echo?: string; phoneMask?: string }
  return { res, data }
}

export function SignupForm({ providers, startAt = 1, social, socialProvider, account }: Props) {
  const { plan, locked, lock } = useSignupPlan()
  const [step, setStep] = useState<SignupStep>(startAt)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // step 1
  const [profileKind, setProfileKind] = useState<SignupProfileKind>(plan?.profileKind ?? 'ARTIST')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [terms, setTerms] = useState(false)
  const [tried, setTried] = useState(false)
  // step 2
  const [emailToken, setEmailToken] = useState<string | null>(null)
  const [emailEcho, setEmailEcho] = useState<string | null>(null)
  const [emailCode, setEmailCode] = useState('')
  // step 3
  const [phone, setPhone] = useState('')
  const [phoneToken, setPhoneToken] = useState<string | null>(null)
  const [phoneMask, setPhoneMask] = useState<string | null>(null)
  const [phoneEcho, setPhoneEcho] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('')
  // step 4
  const [uses, setUses] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [newsletter, setNewsletter] = useState(true)
  const [socialTerms, setSocialTerms] = useState(false)

  // The plan chip of the aside chooses the default profile (prototype: `perfil: PLANOS[k].perfil`).
  const [seenPlan, setSeenPlan] = useState<string | null>(plan?.code ?? null)
  if (plan && !locked && plan.code !== seenPlan) { setSeenPlan(plan.code); setProfileKind(plan.profileKind) }

  const notice = social ? SOCIAL_NOTICE[social] ?? null : null
  const needsSocialTerms = startAt >= 3
  const displayName = (name || account?.name || '').trim().split(/\s+/)[0] || ''

  const rules = useMemo(() => [
    ['8 caracteres ou mais', password.length >= 8],
    ['Pelo menos um número', /\d/.test(password)],
    ['Pelo menos uma letra', /[A-Za-z]/.test(password)],
  ] as const, [password])

  function toggle(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key])
  }

  async function startSignup(e: FormEvent) {
    e.preventDefault(); setTried(true); setError(null)
    if (!terms) { setError('Aceite os termos de uso para criar a conta.'); return }
    if (rules.some((r) => !r[1])) { setError('A senha precisa ter 8 caracteres, com letras e números.'); return }
    setBusy(true)
    const { res, data } = await post('/api/auth/signup/start', { name: name.trim(), email: email.trim(), password, profileKind })
    setBusy(false)
    if (!res.ok || !data.token) { setError(data.error ?? 'Não foi possível criar a conta.'); return }
    setEmailToken(data.token); setEmailEcho(data.echo ?? null); setEmailCode(''); lock(); setStep(2)
  }

  async function verifyEmail(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (emailCode.length !== 6) { setError('Digite os 6 dígitos do código.'); return }
    setBusy(true)
    const { res, data } = await post('/api/auth/code/verify', { token: emailToken, code: emailCode })
    if (!res.ok) { setBusy(false); setError(data.error ?? 'Código inválido ou vencido.'); return }
    // The account exists and the session is open: record the acceptance read on step 1.
    await post('/api/auth/preferences', { termsAccepted: true }, 'PATCH')
    setBusy(false); setStep(3)
  }

  async function resendEmail() {
    if (!emailToken) return
    setError(null); setBusy(true)
    const { data } = await post('/api/auth/code/resend', { token: emailToken })
    setBusy(false)
    if (data.echo) setEmailEcho(data.echo)
  }

  async function startPhone(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (!normalizeBrMobile(phone)) { setError('Informe um celular brasileiro com DDD, começando com 9.'); return }
    setBusy(true)
    const { res, data } = await post('/api/auth/phone/start', { phone })
    setBusy(false)
    if (!res.ok || !data.token) { setError(data.error ?? 'Não foi possível enviar o SMS.'); return }
    setPhoneToken(data.token); setPhoneMask(data.phoneMask ?? phone); setPhoneEcho(data.echo ?? null); setPhoneCode('')
  }

  async function verifyPhone(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (phoneCode.length !== 6) { setError('Digite os 6 dígitos do código.'); return }
    setBusy(true)
    const { res, data } = await post('/api/auth/phone/verify', { token: phoneToken, code: phoneCode })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Código inválido ou vencido.'); return }
    if (data.phoneMask) setPhoneMask(data.phoneMask)
    setStep(4)
  }

  async function resendPhone() {
    if (!phoneToken) return
    setError(null); setBusy(true)
    const { data } = await post('/api/auth/phone/resend', { token: phoneToken })
    setBusy(false)
    if (data.echo) setPhoneEcho(data.echo)
  }

  async function savePreferences(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (uses.length === 0) { setError('Escolha ao menos uma forma de usar a HouseArt.'); return }
    if (needsSocialTerms && !socialTerms) { setError('Aceite os termos de uso para concluir o cadastro.'); return }
    setBusy(true)
    const { res, data } = await post('/api/auth/preferences', { uses, interests, city: city.trim(), marketingOptIn: newsletter, ...(needsSocialTerms ? { termsAccepted: true } : {}) }, 'PATCH')
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível salvar as preferências.'); return }
    setStep(5)
  }

  const header = step === 1 ? null : (
    <div className="ha-signup__head">
      <div className="ha-signup__headrow">
        {step === 2 ? (
          <button type="button" className="ha-signup__back" aria-label="Voltar" onClick={() => { setStep(1); setError(null) }}><Icon name="arrow_back" size={22} /></button>
        ) : null}
        <span className="ha-signup__stepno">{step === 5 ? 'Pronto' : `Passo ${step} de 4`}</span>
      </div>
      <div className="ha-signup__segments" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={`ha-signup__seg${i <= step ? ' ha-signup__seg--on' : ''}`} />)}
      </div>
    </div>
  )

  const title = step === 5 ? `Conta criada, ${displayName || 'bem-vindo(a)'}.` : STEP_TITLES[step][0]
  const sub = STEP_TITLES[step][1]

  return (
    <div className="ha-signup" data-step={step}>
      {header}
      <div className="ha-signup__title">
        <h1 className="ha-h1">{title}</h1>
        {step === 1
          ? <p className="ha-signup__sub">Já tem conta? <a className="ha-link" href="/login">Entrar</a></p>
          : <p className="ha-signup__sub">{sub}</p>}
      </div>

      {notice && step === 1 ? <p className="ha-signup__notice" role="status">{notice}{social === 'no-account' && socialProvider ? ` (${SOCIAL.find((s) => s.slug === socialProvider)?.name ?? socialProvider})` : ''}</p> : null}

      {step === 1 ? (
        <>
          <div className="ha-signup__socials">
            {SOCIAL.map((s) => {
              const on = providers.includes(s.key)
              const href = `/api/auth/oauth/${s.slug}/start?purpose=signup&profileKind=${profileKind}${plan ? `&plan=${encodeURIComponent(plan.code)}` : ''}`
              const inner = <><span className={`ha-signup__social-badge ha-signup__social-badge--${s.slug}`} aria-hidden="true"><ProviderMark slug={s.slug} /></span>Continuar com {s.name}</>
              return on
                ? <a key={s.key} className="ha-signup__social" href={href}>{inner}</a>
                : <span key={s.key} className="ha-signup__social ha-signup__social--off" aria-disabled="true" title="Em breve">{inner}</span>
            })}
            {providers.includes('MOCK') ? (
              <a className="ha-signup__social ha-signup__social--mock" href={`/api/auth/oauth/mock/start?purpose=signup&profileKind=${profileKind}${plan ? `&plan=${encodeURIComponent(plan.code)}` : ''}`}>
                <span className="ha-signup__social-badge ha-signup__social-badge--mock" aria-hidden="true"><Icon name="science" size={14} /></span>Provedor simulado (dev)
              </a>
            ) : null}
          </div>

          <div className="ha-signup__divider"><span />ou com e-mail<span /></div>

          <form className="ha-signup__form" onSubmit={startSignup} noValidate>
            <div className="ha-signup__field">
              <span className="ha-signup__label" id="signup-profile-label">Eu sou</span>
              <div className="ha-signup__segmented" role="radiogroup" aria-labelledby="signup-profile-label">
                {SELF_SIGNUP.map((kind) => {
                  const card = PROFILE_CARDS.find((c) => c.kind === kind)
                  return (
                    <button key={kind} type="button" role="radio" aria-checked={profileKind === kind} className={`ha-signup__segment${profileKind === kind ? ' ha-signup__segment--on' : ''}`} onClick={() => setProfileKind(kind)}>{card?.name ?? kind}</button>
                  )
                })}
              </div>
            </div>
            <label className="ha-label">Nome completo
              <input className="ha-input" name="name" autoComplete="name" placeholder="Como aparece no certificado" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} aria-invalid={tried && name.trim().length < 3 ? true : undefined} />
            </label>
            <label className="ha-label">E-mail
              <input className="ha-input" type="email" name="email" autoComplete="email" inputMode="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-invalid={tried && !email.includes('@') ? true : undefined} />
            </label>
            <label className="ha-label">Senha
              <span className="ha-signup__password">
                <input className="ha-input" type={showPassword ? 'text' : 'password'} name="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} aria-invalid={tried && rules.some((r) => !r[1]) ? true : undefined} />
                <button type="button" className="ha-signup__eye" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}><Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} /></button>
              </span>
            </label>
            {password ? (
              <ul className="ha-signup__rules" aria-label="Regras da senha">
                {rules.map(([t, ok]) => <li key={t} className={ok ? 'ha-signup__rule ha-signup__rule--ok' : 'ha-signup__rule'}><Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} size={16} />{t}</li>)}
              </ul>
            ) : null}
            <label className={`ha-signup__terms${tried && !terms ? ' ha-signup__terms--bad' : ''}`}>
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
              <span>Aceito os <a className="ha-signup__termlink" href="/terms" target="_blank" rel="noreferrer">termos de uso</a> e a <a className="ha-signup__termlink" href="/privacy" target="_blank" rel="noreferrer">política de privacidade</a>.</span>
            </label>
            {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
            <Button type="submit" variant="ink" size="md" loading={busy} className="ha-signup__cta">{plan?.cta ?? 'Criar conta'}</Button>
          </form>
        </>
      ) : null}

      {step === 2 ? (
        <form className="ha-signup__form" onSubmit={verifyEmail}>
          <CodeField value={emailCode} onChange={setEmailCode} label="Código do e-mail" />
          <p className="ha-signup__meta"><Icon name="mail" size={18} />Código enviado para <b>{email || 'o seu e-mail'}</b></p>
          <p className="ha-signup__meta ha-signup__meta--split"><span>Não chegou? Veja a caixa de spam.</span><Resend onResend={resendEmail} disabled={busy} /></p>
          <EchoHint code={emailEcho} />
          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <Button type="submit" variant="primary" size="md" loading={busy} className="ha-signup__cta" disabled={emailCode.length !== 6}>Confirmar código</Button>
          <button type="button" className="ha-link ha-link--quiet ha-signup__alt" onClick={() => { setStep(1); setError(null) }}>Trocar e-mail</button>
        </form>
      ) : null}

      {step === 3 && !phoneToken ? (
        <form className="ha-signup__form" onSubmit={startPhone}>
          <label className="ha-label">Celular
            <input className="ha-input" type="tel" name="phone" autoComplete="tel-national" inputMode="tel" placeholder="(71) 99999-9999" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} required />
          </label>
          <p className="ha-signup__meta">Enviamos um código por SMS. Não ligamos nem mandamos propaganda.</p>
          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <Button type="submit" variant="primary" size="md" loading={busy} className="ha-signup__cta">Enviar código por SMS</Button>
        </form>
      ) : null}

      {step === 3 && phoneToken ? (
        <form className="ha-signup__form" onSubmit={verifyPhone}>
          <CodeField value={phoneCode} onChange={setPhoneCode} label="Código do SMS" />
          <p className="ha-signup__meta ha-signup__meta--split"><span>SMS para {phoneMask}</span><Resend onResend={resendPhone} disabled={busy} /></p>
          <EchoHint code={phoneEcho} />
          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <Button type="submit" variant="primary" size="md" loading={busy} className="ha-signup__cta" disabled={phoneCode.length !== 6}>Confirmar código</Button>
          <button type="button" className="ha-link ha-link--quiet ha-signup__alt" onClick={() => { setPhoneToken(null); setPhoneCode(''); setError(null) }}>Trocar número</button>
        </form>
      ) : null}

      {step === 4 ? (
        <form className="ha-signup__form" onSubmit={savePreferences}>
          <div className="ha-signup__uses" role="group" aria-label="Como você vai usar">
            {PREFERENCE_USES.map((u) => {
              const on = uses.includes(u)
              return (
                <button key={u} type="button" aria-pressed={on} className={`ha-signup__use${on ? ' ha-signup__use--on' : ''}`} onClick={() => toggle(uses, setUses, u)}>
                  <Icon name={USE_ICONS[u]} size={24} />
                  <span className="ha-signup__use-name">{USE_LABELS[u]}</span>
                  <Icon name={on ? 'check_box' : 'check_box_outline_blank'} size={22} filled={on} />
                </button>
              )
            })}
          </div>
          <span className="ha-signup__label">O que você gosta de ver</span>
          <div className="ha-signup__chips" role="group" aria-label="Interesses">
            {PREFERENCE_INTERESTS.map((i) => {
              const on = interests.includes(i)
              return <button key={i} type="button" aria-pressed={on} className={`ha-chip${on ? ' ha-chip--on' : ''}`} onClick={() => toggle(interests, setInterests, i)}>{INTEREST_LABELS[i]}</button>
            })}
          </div>
          <label className="ha-label">Cidade
            <input className="ha-input" name="city" autoComplete="address-level2" placeholder="Salvador, BA" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </label>
          <div className="ha-signup__optin">
            <span>Quero receber aberturas, novidades e obras novas dos artistas que sigo.</span>
            <Toggle on={newsletter} onChange={setNewsletter} label="Receber novidades por e-mail" />
          </div>
          {needsSocialTerms ? (
            <label className={`ha-signup__terms${error && !socialTerms ? ' ha-signup__terms--bad' : ''}`}>
              <input type="checkbox" checked={socialTerms} onChange={(e) => setSocialTerms(e.target.checked)} required />
              <span>Li e aceito os <a className="ha-signup__termlink" href="/terms" target="_blank" rel="noreferrer">termos de uso</a>, a <a className="ha-signup__termlink" href="/privacy" target="_blank" rel="noreferrer">política de privacidade</a> e as regras de garantia e escritura da HouseArt.</span>
            </label>
          ) : null}
          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <Button type="submit" variant="primary" size="md" loading={busy} className="ha-signup__cta">Concluir cadastro</Button>
        </form>
      ) : null}

      {step === 5 ? (
        <div className="ha-signup__done">
          <div className="ha-signup__seal" aria-hidden="true">
            <svg width="120" height="120" viewBox="0 0 104 104"><circle cx="52" cy="52" r="48" fill="none" strokeWidth="4" strokeDasharray="302" className="ha-signup__seal-ring" /></svg>
            <span className="ha-signup__seal-core"><Icon name="check" size={40} /></span>
          </div>
          <dl className="ha-signup__summary">
            <Row k="Nome" v={name || account?.name || '—'} />
            <Row k="E-mail" v={`${email || account?.email || '—'} · verificado`} />
            <Row k="Celular" v={`${phoneMask ?? '—'} · verificado`} />
            <Row k="Interesses" v={interests.map((i) => INTEREST_LABELS[i as keyof typeof INTEREST_LABELS]).join(', ') || '—'} />
          </dl>
          <a className="ha-btn ha-btn--primary ha-btn--md ha-signup__cta" href="/profiles">Começar a explorar</a>
        </div>
      ) : null}
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="ha-signup__row"><dt>{k}</dt><dd>{v}</dd></div>
}

/** 6 boxes mirroring one numeric input (the app prototype's `cdCaixas`). */
function CodeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])
  return (
    <div className="ha-signup__code">
      <div className="ha-signup__boxes" aria-hidden="true" onClick={() => ref.current?.focus()}>
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`ha-signup__box${i === value.length ? ' ha-signup__box--cursor' : value[i] ? ' ha-signup__box--filled' : ''}`}>{value[i] ?? ''}</span>)}
      </div>
      <input ref={ref} className="ha-input ha-signup__code-input" inputMode="numeric" autoComplete="one-time-code" aria-label={label} placeholder="Digite o código" value={value} maxLength={6} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </div>
  )
}

/** "Reenviar em 0:30" → "Reenviar código" (the prototype's countdown). */
function Resend({ onResend, disabled }: { onResend: () => void; disabled?: boolean }) {
  const [left, setLeft] = useState(30)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  if (left > 0) return <span className="ha-signup__resend-wait">Reenviar em 0:{String(left).padStart(2, '0')}</span>
  return <button type="button" className="ha-link" disabled={disabled} onClick={() => { setLeft(30); onResend() }}>Reenviar código</button>
}

/** Dev only: the start response echoes the code (AUTH_CODE_ECHO=1). Shown small, never in production. */
function EchoHint({ code }: { code: string | null }) {
  if (!code) return null
  return <p className="ha-signup__echo">Ambiente de teste · código: <code>{code}</code></p>
}
