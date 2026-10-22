'use client'
// Pix para receber vendas (handoff "HouseArt App Colecionador" › sheet pix).
// "Não cadastrado" = the sheet's form; cadastrado = the card of the wallet
// block, with "Trocar chave" (reopens the form) and "Remover".
import { useCallback, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { checkPixKey, PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import type { PayoutAccountView } from '@/lib/payment-methods/server'

type FormType = Extract<PixKeyType, 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM'>
const TYPES: { key: FormType; name: string; icon: string; label: string; placeholder: string; mode: 'numeric' | 'email' | 'tel' | 'text' }[] = [
  { key: 'CPF', name: 'CPF', icon: 'badge', label: 'Seu CPF', placeholder: '000.000.000-00', mode: 'numeric' },
  { key: 'EMAIL', name: 'E-mail', icon: 'alternate_email', label: 'E-mail cadastrado no banco', placeholder: 'voce@email.com', mode: 'email' },
  { key: 'PHONE', name: 'Celular', icon: 'smartphone', label: 'Celular cadastrado no banco', placeholder: '(71) 99999-9999', mode: 'tel' },
  { key: 'RANDOM', name: 'Aleatória', icon: 'key', label: '', placeholder: '', mode: 'text' },
]

const fCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
const fPhone = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length < 3) return d; if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` }

export function PayoutAccountScreen({ account: initial, holderName, cpfMask }: { account: PayoutAccountView | null; holderName: string; cpfMask: string | null }) {
  const [account, setAccount] = useState(initial)
  const [editing, setEditing] = useState(initial === null)
  const [type, setType] = useState<FormType>('CPF')
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const t = TYPES.find((x) => x.key === type)!

  function pick(k: FormType) { setType(k); setKey(''); setError('') }
  function onKey(v: string) { setKey(type === 'CPF' ? fCpf(v) : type === 'PHONE' ? fPhone(v) : v); setError('') }
  async function paste() {
    try { const v = await navigator.clipboard.readText(); if (v) onKey(v.trim()) } catch { setError('Não foi possível ler a área de transferência. Cole a chave no campo.') }
  }

  async function save() {
    if (!key.trim()) { setError(''); return }
    const local = checkPixKey(type, key, null)
    if (!local.ok) { setError(local.error); return }
    setSaving(true)
    const res = await fetch('/api/member/payout-account', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, key: key.trim(), holderName }) })
    const data = await res.json().catch(() => ({})) as { account?: PayoutAccountView; error?: string }
    setSaving(false)
    if (!res.ok || !data.account) { setError(data.error ?? 'Não foi possível cadastrar a chave.'); return }
    setAccount(data.account)
    setEditing(false)
    setKey('')
    setToast('Chave Pix confirmada no seu nome · pronta para receber')
  }

  async function remove() {
    const res = await fetch('/api/member/payout-account', { method: 'DELETE' })
    if (!res.ok) { setToast('Não foi possível remover a chave.'); return }
    setAccount(null)
    setEditing(true)
    setType('CPF'); setKey(''); setError('')
    setToast('Chave Pix removida · cadastre outra para receber vendas')
  }

  const holderLine = cpfMask ? `${holderName} · CPF ${cpfMask}` : holderName

  return (
    <div className="ha-payout">
      <section className="ha-card ha-card--pad ha-payout__main">
        {account && !editing ? (
          <>
            <div className="ha-payout-card">
              <div className="ha-payout-card__row">
                <span className="ha-payout-card__ic"><Icon name="account_balance" size={20} /></span>
                <span className="ha-stack">
                  <span className="ha-payout-card__k">Chave Pix · {PIX_KEY_TYPE_LABELS[account.pixKeyType as PixKeyType] ?? account.pixKeyType}</span>
                  <span className="ha-payout-card__v">{account.pixKeyMask}</span>
                </span>
              </div>
              <span className="ha-payout-card__holder"><Icon name="verified" size={16} filled />{account.holderName} · titular da conta</span>
              <span className="ha-payout-card__s">Repasse em até 1 dia útil depois que o comprador confirma a entrega.</span>
            </div>
            <div className="ha-payout-foot">
              <div className="ha-payout-foot__secondary">
                <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setEditing(true); setError('') }}>Trocar chave</button>
                <button type="button" className="ha-payout-remove" onClick={remove}>Remover</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="ha-payout__sub">{account ? 'Troque a chave onde você recebe o valor das vendas. Repasses em andamento vão para a chave anterior.' : 'É para esta chave que enviamos o valor das suas vendas, depois que o comprador confirma a entrega.'}</p>
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
              <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={saving || !key.trim()} onClick={save}>{saving ? 'Consultando a chave no Banco Central…' : account ? 'Salvar nova chave' : 'Cadastrar chave Pix'}</button>
              {account ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={() => { setEditing(false); setError('') }}>Cancelar</button> : null}
              {account ? <button type="button" className="ha-payout-remove" onClick={remove}>Remover chave</button> : null}
            </div>
          </>
        )}
      </section>
      <aside className="ha-payout__aside">
        <div className="ha-payout-notes">
          <span><Icon name="schedule" size={16} />O valor da venda cai em até 1 dia útil depois que o comprador confirma a entrega.</span>
          <span><Icon name="receipt_long" size={16} />Você recebe já com a taxa HouseArt e o direito de sequência descontados, com comprovante.</span>
        </div>
      </aside>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
