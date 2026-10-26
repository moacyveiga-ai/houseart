'use client'
// Conta da galeria › Dados da galeria (handoff "HouseArt Web Galeria" › Galeria › Conta › Dados):
// name and CNPJ locked (they come from the signup), e-mail, celular with the mask, cidade and the
// one-line summary, "Salvar alterações" → PATCH /api/gallery/account. Staff who are not the
// ADMIN read it: only the administration changes the gallery's data.
import Link from 'next/link'
import { useState, type ChangeEvent } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { formatPhoneInput } from '@/lib/sms/core'
import type { GalleryAccountView } from '@/lib/gallery/account-server'

export function GalleryDataForm({ account }: { account: GalleryAccountView }) {
  const [form, setForm] = useState({ ...account.data, phone: account.data.phone ? formatPhoneInput(account.data.phone) : '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const ro = !account.isAdmin
  const on = (k: keyof typeof form, fmt: (v: string) => string = (v) => v) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((f) => ({ ...f, [k]: fmt(e.target.value) })); setError('') }

  async function save() {
    setSaving(true); setError('')
    const res = await fetch('/api/gallery/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { data?: GalleryAccountView['data']; error?: string } | undefined
    setSaving(false)
    if (!res?.ok || !data?.data) { setError(data?.error ?? 'Não foi possível salvar.'); return }
    setForm({ ...data.data, phone: data.data.phone ? formatPhoneInput(data.data.phone) : '' })
    setToast('Dados da galeria salvos')
  }

  return (
    <div className="ha-gdata">
      <Link href="/gallery/account" className="ha-gdata__back"><Icon name="arrow_back" size={20} />Conta da galeria</Link>
      {ro ? <p className="ha-gdata__note"><Icon name="info" size={16} />Só a administração da galeria altera estes dados.</p> : null}
      <div className="ha-gdata__grid">
        <label className="ha-gdata__field"><span>Nome da galeria</span><input className="ha-input ha-gdata__ro" value={account.galleryName} readOnly /><small>Vem do cadastro · fale com a HouseArt para alterar</small></label>
        <label className="ha-gdata__field"><span>CNPJ</span><input className="ha-input ha-gdata__ro" value={account.cnpjMask ?? '—'} readOnly /><small>{account.verified.cnpj ? 'Verificado' : 'Não informado'}</small></label>
        <label className="ha-gdata__field"><span>E-mail de contato</span><input className="ha-input" type="email" value={form.email} onChange={on('email')} readOnly={ro} placeholder="contato@galeria.com.br" autoComplete="email" /><small>Aparece na página pública e recebe os avisos da galeria</small></label>
        <label className="ha-gdata__field"><span>Celular</span><input className="ha-input" value={form.phone} onChange={on('phone', formatPhoneInput)} readOnly={ro} inputMode="tel" placeholder="(71) 99999-0000" autoComplete="tel" /></label>
        <label className="ha-gdata__field"><span>Cidade</span><input className="ha-input" value={form.city} onChange={on('city')} readOnly={ro} placeholder="Salvador" /></label>
        <label className="ha-gdata__field ha-gdata__field--wide"><span>Sobre a galeria</span><textarea className="ha-input ha-gdata__ta" value={form.summary} onChange={on('summary')} readOnly={ro} maxLength={200} rows={3} placeholder="Uma linha sobre a galeria, para o site e a comunidade" /><small>{form.summary.length}/200</small></label>
      </div>
      {error ? <p className="ha-gdata__err" role="alert">{error}</p> : null}
      {ro ? null : <div className="ha-row"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={saving} onClick={save} aria-busy={saving || undefined}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
