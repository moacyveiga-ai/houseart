'use client'
// Entrar (handoff "HouseArt Entrar.dc.html"): social buttons, e-mail/CPF +
// password with the eye, "Manter conectado", "Esqueci minha senha" in place
// (the card turns into the ForgotPasswordForm, no page change), and the
// discreet alternative "entrar com código por e-mail" the API already offers.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { ProviderMark } from './ProviderMark'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { SOCIAL_BUTTONS, socialMessage, socialStartHref } from './social-messages'
import './login.css'

type Stage = 'password' | 'code-start' | 'code-verify' | 'forgot'

export interface LoginFormProps {
  next: string | null
  /** providers configured in this env (`configuredProviders`, read by the page) */
  providers: readonly string[]
  /** `?social=` code of the callback, when the social login came back with an error */
  social: string | null
}


export function LoginForm({ next, providers, social }: LoginFormProps) {
  const [stage, setStage] = useState<Stage>('password')
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [socialError, setSocialError] = useState<string | null>(() => socialMessage(social))
  const [busy, setBusy] = useState<false | string>(false)

  const configured = new Set(providers)
  const mockOn = configured.has('MOCK')

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; token?: string; next?: string | null }
    return { res, data }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!credential.trim() || !password) { setError('Preencha e-mail e senha para entrar.'); return }
    setBusy('Entrando…'); setError(null); setSocialError(null)
    const { res, data } = await post('/api/auth/login', { credential: credential.trim(), password, next, remember })
    if (!res.ok) { setBusy(false); setError(data.error ?? 'Não foi possível entrar.'); return }
    window.location.assign(data.next ?? '/profiles')
  }

  async function startCode(e: React.FormEvent) {
    e.preventDefault()
    if (!credential.includes('@')) { setError('Informe o e-mail da conta para receber o código.'); return }
    setBusy('Enviando…'); setError(null)
    const { res, data } = await post('/api/auth/code/start', { email: credential.trim() })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível enviar o código.'); return }
    setToken(data.token ?? null); setCode(''); setStage('code-verify')
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault(); setBusy('Entrando…'); setError(null)
    const { res, data } = await post('/api/auth/code/verify', { token, code, next })
    if (!res.ok) { setBusy(false); setError(data.error ?? 'Código inválido.'); return }
    window.location.assign(data.next ?? '/profiles')
  }

  function goTo(s: Stage) { setStage(s); setError(null) }

  const header = (title: string, lead: React.ReactNode) => (
    <div className="ha-login__head">
      <h1 className="ha-h1">{title}</h1>
      <p className="ha-login__lead">{lead}</p>
    </div>
  )

  const errorNote = error ? (
    <div className="ha-login-note ha-login-note--error" role="alert"><Icon name="error" size={18} />{error}</div>
  ) : null

  if (stage === 'forgot') {
    return (
      <>
        {header('Recuperar senha', 'Informe o e-mail da conta. Se ele existir, enviamos um link que vale por 1 hora.')}
        <ForgotPasswordForm initialEmail={credential.includes('@') ? credential.trim() : ''} onBack={() => goTo('password')} />
      </>
    )
  }

  if (stage === 'code-verify') {
    return (
      <>
        {header('Confira seu e-mail', <>Enviamos um código de 6 dígitos para <b>{credential.trim()}</b>. Ele vale por 15 minutos.</>)}
        <form className="ha-login-form" onSubmit={verifyCode}>
          <label className="ha-label">Código
            <input className="ha-input ha-input--id" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
          </label>
          {errorNote}
          <button className="ha-btn ha-btn--ink ha-btn--md ha-login-form__submit" disabled={busy !== false} type="submit">
            {busy ? <><span className="ha-spinner" aria-hidden="true" />{busy}</> : 'Entrar'}
          </button>
          <p className="ha-login-alt">Não chegou? <button type="button" className="ha-link" onClick={() => post('/api/auth/code/resend', { token })}>Reenviar código</button></p>
          <button type="button" className="ha-link ha-link--quiet ha-login-form__back" onClick={() => { setToken(null); goTo('password') }}>Voltar</button>
        </form>
      </>
    )
  }

  const codeMode = stage === 'code-start'

  return (
    <>
      {header('Entrar', <>Ainda não tem conta? <a href="/signup">Criar conta</a></>)}

      <div className="ha-login-social" aria-label="Entrar com uma conta social">
        {SOCIAL_BUTTONS.map((b) => configured.has(b.key) ? (
          <a key={b.slug} className={`ha-social-btn ha-social-btn--${b.slug}`} href={socialStartHref(b.slug, 'login', next)}>
            <ProviderMark slug={b.slug} />{b.label}
          </a>
        ) : (
          <span key={b.slug} className={`ha-social-btn ha-social-btn--${b.slug}`} role="button" aria-disabled="true" title="Em breve">
            <ProviderMark slug={b.slug} />{b.label}<span className="ha-social-btn__soon">Em breve</span>
          </span>
        ))}
        {mockOn ? (
          <a className="ha-social-btn ha-social-btn--mock" href={socialStartHref('mock', 'login', next)}>
            <ProviderMark slug="mock" />Provedor simulado (dev)
          </a>
        ) : null}
      </div>

      <div className="ha-divider"><span>{codeMode ? 'ou com código por e-mail' : 'ou com e-mail e senha'}</span></div>

      <form className="ha-login-form" onSubmit={codeMode ? startCode : submitPassword} noValidate>
        <label className="ha-label">{codeMode ? 'E-mail' : 'E-mail ou CPF'}
          <input className="ha-input" autoComplete="username" inputMode={codeMode ? 'email' : undefined} placeholder="voce@email.com" value={credential} onChange={(e) => { setCredential(e.target.value); setError(null) }} aria-invalid={error && !credential ? true : undefined} />
        </label>
        {codeMode ? null : (
          <label className="ha-label">
            <span className="ha-login-form__label-row">Senha
              <button type="button" className="ha-login-form__forgot" onClick={() => goTo('forgot')}>Esqueci minha senha</button>
            </span>
            <span className="ha-login-form__pw">
              <input className="ha-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} aria-invalid={error && credential && !password ? true : undefined} />
              <button type="button" className="ha-login-form__eye" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </span>
          </label>
        )}
        {errorNote}
        {socialError && !error ? (
          <div className="ha-login-note ha-login-note--error" role="alert"><Icon name="error" size={18} />{socialError}</div>
        ) : null}
        <label className="ha-login-form__check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Manter conectado neste dispositivo
        </label>
        <button className="ha-btn ha-btn--ink ha-btn--md ha-login-form__submit" disabled={busy !== false} type="submit">
          {busy ? <><span className="ha-spinner" aria-hidden="true" />{busy}</> : codeMode ? 'Receber código' : 'Entrar'}
        </button>
      </form>

      <p className="ha-login-alt">
        {codeMode ? (
          <button type="button" className="ha-link" onClick={() => goTo('password')}>Entrar com senha</button>
        ) : (
          <>Sem senha? <button type="button" className="ha-link" onClick={() => goTo('code-start')}>Entrar com código por e-mail</button></>
        )}
      </p>

      <p className="ha-login-consent">Ao entrar, você concorda com os <a href="/terms">Termos de uso</a> e a <a href="/privacy">Política de privacidade</a> da HouseArt.</p>
    </>
  )
}
