'use client'
// "Registrar embalagem e condition report" (audit galeria §4): the seller photographs the packed
// work and writes its condition before the carrier picks it up; the buyer sees the same record.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { Button } from '@/components/ds/Button'
import { shrinkToJpeg } from '@/components/artworks/capture-render'
import './packaging.css'
import { CONDITION_REPORT_MAX, CONDITION_REPORT_MIN, PACKAGING_MAX_PHOTOS } from '@/lib/deals/packaging-core'

export interface PackagingData { report: string | null; packedAt: string | null; photos: { id: number; url: string }[] }

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })

function Photos({ photos, onRemove, busy }: { photos: PackagingData['photos']; onRemove?: (id: number) => void; busy?: boolean }) {
  if (!photos.length) return null
  return (
    <div className="ha-pack__photos">
      {photos.map((p, i) => (
        <span key={p.id} className="ha-pack__photo">
          <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${i + 1} da embalagem`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private vault photo, streamed by the deal route */}
            <img src={p.url} alt="" />
          </a>
          {onRemove ? <button type="button" className="ha-pack__remove" aria-label={`Tirar a foto ${i + 1}`} disabled={busy} onClick={() => onRemove(p.id)}><Icon name="close" size={16} /></button> : null}
        </span>
      ))}
    </div>
  )
}

/** The buyer's (read-only) view: shown once the seller recorded the packaging. */
export function PackagingView({ p }: { p: PackagingData }) {
  if (!p.packedAt) return null
  return (
    <div className="ha-pack ha-stack ha-stack--3">
      <div className="ha-row"><Icon name="inventory_2" size={20} /><b>Embalagem e condition report</b><span className="ha-muted ha-sm">· {day(p.packedAt)}</span></div>
      {p.report ? <p className="ha-sm ha-pack__report">{p.report}</p> : null}
      <Photos photos={p.photos} />
    </div>
  )
}

/** The seller's form: photos (up to six) and the condition note, then "Registrar embalagem". */
export function PackagingForm({ dealId, p, onDone }: { dealId: number; p: PackagingData; onDone?: (msg: string) => void }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState(p.report ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const full = p.photos.length >= PACKAGING_MAX_PHOTOS
  const ready = report.trim().length >= CONDITION_REPORT_MIN && p.photos.length > 0

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy('photo'); setError('')
    try {
      for (const file of Array.from(files).slice(0, PACKAGING_MAX_PHOTOS - p.photos.length)) {
        let blob: Blob = file
        try { blob = await shrinkToJpeg(file) } catch { /* the server re-encodes and says what is wrong */ }
        const form = new FormData(); form.append('file', blob, 'embalagem.jpg')
        const res = await fetch(`/api/deals/${dealId}/packaging/photos`, { method: 'POST', body: form })
        const data = await res.json().catch(() => ({})) as { error?: string }
        if (!res.ok) { setError(data.error ?? 'Não foi possível enviar a foto.'); break }
      }
    } catch { setError('Sem conexão. Tente de novo.') }
    setBusy(null)
    if (input.current) input.current.value = ''
    router.refresh()
  }
  async function remove(id: number) {
    setBusy('remove'); setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/packaging/photos/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) setError(data.error ?? 'Não foi possível tirar a foto.')
    } catch { setError('Sem conexão. Tente de novo.') }
    setBusy(null)
    router.refresh()
  }
  async function save() {
    setBusy('save'); setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/packaging`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ report }) })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Não foi possível registrar.'); setBusy(null); return }
      onDone?.(p.packedAt ? 'Condition report atualizado' : 'Embalagem registrada · o comprador foi avisado')
    } catch { setError('Sem conexão. Tente de novo.') }
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="ha-pack ha-stack ha-stack--3">
      <div className="ha-row"><Icon name="inventory_2" size={20} /><b>{p.packedAt ? `Embalagem registrada · ${day(p.packedAt)}` : 'Registrar embalagem e condition report'}</b></div>
      <p className="ha-muted ha-sm" style={{ margin: 0 }}>Fotografe a obra antes e depois de embalar e descreva o estado dela. O comprador vê o mesmo registro.</p>
      <Photos photos={p.photos} onRemove={remove} busy={busy !== null} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files) }} />
      {full ? null : <Button variant="outline" size="sm" loading={busy === 'photo'} disabled={busy !== null} onClick={() => input.current?.click()}><Icon name="add_a_photo" size={18} />Adicionar fotos ({p.photos.length}/{PACKAGING_MAX_PHOTOS})</Button>}
      <label className="ha-stack ha-stack--2">
        <span className="ha-sm">Condition report</span>
        <textarea className="ha-input" rows={3} maxLength={CONDITION_REPORT_MAX} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Ex.: tela íntegra, moldura com um risco leve no canto inferior direito, embalagem em caixa de madeira." />
      </label>
      {error ? <p className="ha-sm ha-pack__error" role="alert">{error}</p> : null}
      <Button variant="primary" size="sm" loading={busy === 'save'} disabled={busy !== null || !ready} onClick={() => { void save() }}>{p.packedAt ? 'Atualizar condition report' : 'Registrar embalagem'}</Button>
    </div>
  )
}
