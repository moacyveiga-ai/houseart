'use client'
// Dados pessoais › trocar o e-mail ou o celular: o código vai ao contato NOVO
// e só depois de provado ele substitui o antigo (rotas /api/auth/{email,phone}).
import { useState } from 'react'
import { Button } from '@/components/ds/Button'
import { formatPhoneInput } from '@/lib/sms/core'

type Kind = 'email' | 'phone'
const COPY: Record<Kind, { label: string; placeholder: string; sent: string; done: string }> = {
  email: { label: 'Novo e-mail', placeholder: 'voce@exemplo.com', sent: 'Enviamos um código ao novo e-mail.', done: 'E-mail trocado. Use o novo para entrar.' },
  phone: { label: 'Novo celular', placeholder: '(71) 99999-0000', sent: 'Enviamos um código por SMS ao novo celular.', done: 'Celular confirmado.' },
}

export function ContactChange({ kind, k, value, note }: { kind: Kind; k: string; value: string; note?: string }) {
  const [shown, setShown] = useState(value)
  const [shownNote, setShownNote] = useState(note)
  const [step, setStep] = useState<'idle' | 'edit' | 'code'>('idle')
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const c = COPY[kind]

  async function post(path: string, body: unknown): Promise<{ ok?: boolean; error?: string; token?: string; email?: string; phoneMask?: string; echo?: string }> {
    const r = await fetch(`/api/auth/${kind}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    return (await r?.json().catch(() => ({}))) ?? { error: 'Sem conexão. Tente de novo.' }
  }
  async function start() {
    setBusy(true); setMsg('')
    const j = await post('start', kind === 'email' ? { email: input } : { phone: input })
    setBusy(false)
    if (!j.ok || !j.token) { setMsg(j.error ?? 'Não foi possível enviar o código.'); return }
    setToken(j.token); setCode(j.echo ?? ''); setStep('code'); setMsg(c.sent)
  }
  async function verify() {
    setBusy(true); setMsg('')
    const j = await post('verify', { token, code })
    setBusy(false)
    if (!j.ok) { setMsg(j.error ?? 'Código inválido.'); return }
    setShown(kind === 'email' ? j.email ?? input : j.phoneMask ?? input)
    setShownNote('Verificado')
    setStep('idle'); setInput(''); setCode(''); setToken(''); setMsg(c.done)
  }
  async function resend() {
    setBusy(true)
    const j = await post('resend', { token })
    setBusy(false)
    if (j.echo) setCode(j.echo)
    setMsg('Se o código não chegar em alguns minutos, confira o endereço e peça de novo.')
  }
  function cancel() { setStep('idle'); setInput(''); setCode(''); setToken(''); setMsg('') }

  return (
    <div className="ha-cacct__field">
      <span className="ha-cacct__field-k">{k}<span className="ha-cacct__field-n">{shownNote}</span></span>
      <div className="ha-cacct__contact">
        <input className="ha-input ha-cacct__ro" value={shown} readOnly aria-label={k} />
        {step === 'idle' ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setStep('edit'); setMsg('') }}>{value === '—' && shown === '—' ? 'Adicionar' : 'Alterar'}</button> : null}
      </div>
      {step === 'edit' ? (
        <form className="ha-cacct__contact" onSubmit={(e) => { e.preventDefault(); void start() }}>
          <input className="ha-input" aria-label={c.label} placeholder={c.placeholder} autoFocus value={input}
            type={kind === 'email' ? 'email' : 'tel'} inputMode={kind === 'email' ? 'email' : 'tel'} autoComplete={kind === 'email' ? 'email' : 'tel'}
            onChange={(e) => setInput(kind === 'phone' ? formatPhoneInput(e.target.value) : e.target.value)} />
          <Button type="submit" size="sm" loading={busy} disabled={!input.trim()}>Enviar código</Button>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={cancel}>Cancelar</button>
        </form>
      ) : null}
      {step === 'code' ? (
        <form className="ha-cacct__contact" onSubmit={(e) => { e.preventDefault(); void verify() }}>
          <input className="ha-input" aria-label="Código de 6 dígitos" placeholder="000000" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <Button type="submit" size="sm" loading={busy} disabled={code.length !== 6}>Confirmar</Button>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" disabled={busy} onClick={() => void resend()}>Reenviar</button>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={cancel}>Cancelar</button>
        </form>
      ) : null}
      {msg ? <span className="ha-cacct__note" role="status">{msg}</span> : null}
    </div>
  )
}
