'use client'
// Endereços de entrega (handoff "Perfil · minha conta" › Cadastro): the list with the default first, add / edit
// in a sheet, "Tornar padrão" and "Remover". The default fills the CEP of the checkout.
import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { UFS } from '@/lib/addresses/core'
import type { AddressView } from '@/lib/addresses/server'
import './collector-account.css'

type Draft = { label: string; recipient: string; cep: string; street: string; number: string; complement: string; district: string; city: string; uf: string; isDefault: boolean }
const blank = (recipient: string): Draft => ({ label: 'Casa', recipient, cep: '', street: '', number: '', complement: '', district: '', city: '', uf: 'BA', isDefault: false })
const draftOf = (a: AddressView): Draft => ({ label: a.label, recipient: a.recipient, cep: a.cep, street: a.street, number: a.number, complement: a.complement ?? '', district: a.district, city: a.city, uf: a.uf, isDefault: a.isDefault })

export function AddressesScreen({ items: initial, recipient }: { items: AddressView[]; recipient: string }) {
  const [items, setItems] = useState(initial)
  const [editing, setEditing] = useState<{ id: number | null; d: Draft } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const r = await fetch('/api/account/addresses', { cache: 'no-store' })
    const j = (await r.json().catch(() => ({}))) as { items?: AddressView[] }
    if (j.items) setItems(j.items)
  }
  async function save() {
    if (!editing || busy) return
    setBusy(true); setError(null)
    const r = await fetch(editing.id ? `/api/account/addresses/${editing.id}` : '/api/account/addresses', { method: editing.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(editing.d) })
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!r.ok) { setError(j.error ?? 'Não foi possível salvar.'); return }
    setEditing(null); await reload()
  }
  async function makeDefault(a: AddressView) {
    await fetch(`/api/account/addresses/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draftOf(a), isDefault: true }) })
    await reload()
  }
  async function remove(a: AddressView) {
    if (!window.confirm(`Remover o endereço "${a.label}"?`)) return
    await fetch(`/api/account/addresses/${a.id}`, { method: 'DELETE' })
    await reload()
  }
  const set = (p: Partial<Draft>) => setEditing((e) => (e ? { ...e, d: { ...e.d, ...p } } : e))

  return (
    <div className="ha-account ha-cacct">
      <div className="ha-cacct__bar"><Link href="/account" className="ha-iconbtn ha-cacct__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link><span className="ha-cacct__bar-t">Endereços de entrega</span></div>
      {items.length === 0 ? <p className="ha-sm ha-muted">Nenhum endereço salvo. O endereço padrão já vem preenchido na compra.</p> : null}
      <div className="ha-account-sec__box">
        {items.map((a) => (
          <div key={a.id} className="ha-account-item ha-cacct__addr">
            <Icon name="location_on" size={22} />
            <span className="ha-stack ha-account-item__txt">
              <span className="ha-account-item__n">{a.label}{a.isDefault ? <span className="ha-cacct__tag">Padrão</span> : null}</span>
              <span className="ha-account-item__s">{a.recipient} · {a.line}</span>
              <span className="ha-row ha-cacct__acts">
                <button type="button" className="ha-cacct__link" onClick={() => { setError(null); setEditing({ id: a.id, d: draftOf(a) }) }}>Editar</button>
                {!a.isDefault ? <button type="button" className="ha-cacct__link" onClick={() => void makeDefault(a)}>Tornar padrão</button> : null}
                <button type="button" className="ha-cacct__link ha-cacct__link--bad" onClick={() => void remove(a)}>Remover</button>
              </span>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => { setError(null); setEditing({ id: null, d: blank(recipient) }) }}><Icon name="add" size={20} />Adicionar endereço</button>

      <Modal open={editing !== null} title={editing?.id ? 'Editar endereço' : 'Novo endereço'} onClose={() => setEditing(null)}>
        {editing ? (
          <form className="ha-cacct__form" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <label className="ha-cacct__field">Nome do endereço<input className="ha-input" value={editing.d.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} placeholder="Casa, Escritório" /></label>
            <label className="ha-cacct__field">Quem recebe<input className="ha-input" value={editing.d.recipient} maxLength={120} onChange={(e) => set({ recipient: e.target.value })} autoComplete="name" /></label>
            <label className="ha-cacct__field">CEP<input className="ha-input" value={editing.d.cep} maxLength={9} inputMode="numeric" onChange={(e) => set({ cep: e.target.value })} autoComplete="postal-code" /></label>
            <label className="ha-cacct__field">Rua<input className="ha-input" value={editing.d.street} maxLength={160} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" /></label>
            <div className="ha-cacct__row2">
              <label className="ha-cacct__field">Número<input className="ha-input" value={editing.d.number} maxLength={20} onChange={(e) => set({ number: e.target.value })} /></label>
              <label className="ha-cacct__field">Complemento<input className="ha-input" value={editing.d.complement} maxLength={80} onChange={(e) => set({ complement: e.target.value })} autoComplete="address-line2" /></label>
            </div>
            <label className="ha-cacct__field">Bairro<input className="ha-input" value={editing.d.district} maxLength={80} onChange={(e) => set({ district: e.target.value })} /></label>
            <div className="ha-cacct__row2">
              <label className="ha-cacct__field">Cidade<input className="ha-input" value={editing.d.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" /></label>
              <label className="ha-cacct__field">Estado<select className="ha-input" value={editing.d.uf} onChange={(e) => set({ uf: e.target.value })}>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
            </div>
            <label className="ha-row ha-cacct__check"><input type="checkbox" checked={editing.d.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} />Usar como padrão</label>
            {error ? <p className="ha-cacct__err" role="alert">{error}</p> : null}
            <button type="submit" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy}>{busy ? 'Salvando…' : 'Salvar endereço'}</button>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
