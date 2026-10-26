'use client'
// The Pix key form of "Pix para receber vendas" (handoff App Colecionador › sheet pix), on its own so
// the sheets that need a key BEFORE an action (accept an offer, publish a listing) can show the same
// form in place. Saves by PUT /api/member/payout-account and hands the account back.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { checkPixKey, type PixKeyType } from '@/lib/payment-methods/domain'
import type { PayoutAccountView } from '@/lib/payment-methods/server'

export type PixFormType = Extract<PixKeyType, 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM'>
const TYPES: { key: PixFormType; name: string; icon: string; label: string; placeholder: string; mode: 'numeric' | 'email' | 'tel' | 'text' }[] = [
  { key: 'CPF', name: 'CPF', icon: 'badge', label: 'Seu CPF', placeholder: '000.000.000-00', mode: 'numeric' },
  { key: 'EMAIL', name: 'E-mail', icon: 'alternate_email', label: 'E-mail cadastrado no banco', placeholder: 'voce@email.com', mode: 'email' },
  { key: 'PHONE', name: 'Celular', icon: 'smartphone', label: 'Celular cadastrado no banco', placeholder: '(71) 99999-9999', mode: 'tel' },
  { key: 'RANDOM', name: 'Aleatória', icon: 'key', label: '', placeholder: '', mode: 'text' },
]

const fCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
const fPhone = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length < 3) return d; if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` }

export function PixKeyForm({ holderName, cpfMask, intro, submitLabel, onSaved, secondary }: {
  holderName: string; cpfMask: string | null; intro?: string; submitLabel: string
  onSaved: (account: PayoutAccountView) => void | Promise<void>
  /** Buttons beside the submit (Cancelar, Remover…). */
  secondary?: React.ReactNode
}) {
  const [type, setType] = useState<PixFormType>('CPF')
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const t = TYPES.find((x) => x.key === type)!

  function pick(k: PixFormType) { setType(k); setKey(''); setError('') }
  function onKey(v: string) { setKey(type === 'CPF' ? fCpf(v) : type === 'PHONE' ? fPhone(v) : v); setError('') }
  async function paste() {
    try { const v = await navigator.clipboard.readText(); if (v) onKey(v.trim()) } catch { setError('Não foi possível ler a área de transferência. Cole a chave no campo.') }
  }
  async function save() {
    if (!key.trim()) { setError(''); return }
    const local = checkPixKey(type, key, null)
    if (!local.ok) { setError(local.error); return }
    setSaving(true)
    try {
      const res = await fetch('/api/member/payout-account', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, key: key.trim(), holderName }) })
      const data = await res.json().catch(() => ({})) as { account?: PayoutAccountView; error?: string }
      if (!res.ok || !data.account) { setError(data.error ?? 'Não foi possível cadastrar a chave.'); return }
      setKey('')
      await onSaved(data.account)
    } catch { setError('Não foi possível cadastrar a chave agora.') } finally { setSaving(false) }
  }

  const holderLine = cpfMask ? `${holderName} · CPF ${cpfMask}` : holderName
  return (
    <>
      {intro ? <p className="ha-payout__sub">{intro}</p> : null}
      <div className="ha-payout__label">
        Tipo de chave
        <div className="ha-payout-types" role="radiogroup" aria-label="Tipo de chave">
          {TYPES.map((x) => (
            <button key={x.key} type="button" role="radio" aria-checked={type === x.key} className={`ha-payout-type${type === x.key ? ' ha-payout-type--on' : ''}`} onClick={() => pick(x.key)}>
              <Icon name={x.icon} size={22} /><span className="ha-payout-type__n">{x.name}</span>
            </button>
          ))}
        </div>
      </div>
      {type === 'RANDOM' ? (
        <div className="ha-payout-random">
          <span className="ha-payout-random__t">Chave aleatória gerada pelo seu banco</span>
          <input className={error ? 'ha-payout-random--error' : ''} value={key} onChange={(e) => onKey(e.target.value)} placeholder="Cole aqui a chave do seu banco" aria-label="Chave aleatória" />
          <button type="button" className="ha-link" onClick={paste}>Colar da área de transferência</button>
        </div>
      ) : (
        <label className="ha-payout__label">
          {t.label}
          <span className={`ha-payout-input${error ? ' ha-payout-input--error' : ''}`}><input value={key} onChange={(e) => onKey(e.target.value)} placeholder={t.placeholder} inputMode={t.mode} /></span>
        </label>
      )}
      {error ? <span className="ha-payout-error" role="alert"><Icon name="error" size={16} />{error}</span> : null}
      <div className="ha-payout-holder">
        <span className="ha-payout-holder__k">Titular da chave</span>
        <span className="ha-payout-holder__v"><Icon name="verified_user" size={18} filled />{holderLine}</span>
        <span className="ha-payout-holder__s">A chave precisa estar no seu CPF. Não aceitamos chaves de terceiros, para proteger a venda e a escritura.</span>
      </div>
      <div className="ha-payout-foot">
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={saving || !key.trim()} onClick={save}>{saving ? 'Consultando a chave no Banco Central…' : submitLabel}</button>
        {secondary}
      </div>
    </>
  )
}
