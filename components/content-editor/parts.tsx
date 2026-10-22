'use client'
// Shared pieces of the content editors: the JSON call, the image input (upload
// to the editor's endpoint, keeps only the returned public URL), the chips of a
// string list and the controls of a repeatable row.
import { useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Button } from '@/components/ds/Button'
import { Field } from '@/components/ds/Field'

export type Reply<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

export async function callJson<T>(url: string, method: string, body?: unknown): Promise<Reply<T>> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as T & { error?: string }
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? 'Não foi possível concluir.' }
    return { ok: true, data }
  } catch { return { ok: false, status: 0, error: 'Sem conexão. Tente de novo.' } }
}

export function ImageInput({ label, value, onChange, uploadUrl, round, hint }: { label: string; value: string | null; onChange: (url: string | null) => void; uploadUrl: string; round?: boolean; hint?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Imagem acima de 10 MB.'); return }
    setBusy(true); setError('')
    const form = new FormData()
    form.set('file', file)
    try {
      const res = await fetch(uploadUrl, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok || !data.url) setError(data.error ?? 'Não foi possível enviar a imagem.')
      else onChange(data.url)
    } catch { setError('Sem conexão. Tente de novo.') }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="ha-label">
      {label}
      <div className="ha-ce-image">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="" className={`ha-ce-image__preview${round ? ' ha-ce-image__preview--round' : ''}`} />
          : <span className={`ha-ce-image__preview${round ? ' ha-ce-image__preview--round' : ''}`} aria-hidden="true"><Icon name="image" size={28} /></span>}
        <div className="ha-ce-image__side">
          <div className="ha-ce-image__btns">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="ha-ce-file" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button variant="outline" size="xs" icon="upload" loading={busy} onClick={() => input.current?.click()}>{value ? 'Trocar imagem' : 'Enviar imagem'}</Button>
            {value ? <Button variant="ghost" size="xs" icon="delete" onClick={() => onChange(null)}>Remover</Button> : null}
          </div>
          {error ? <span className="ha-field-error">{error}</span> : <span className="ha-caption">{hint ?? 'JPEG, PNG ou WebP até 10 MB.'}</span>}
        </div>
      </div>
    </div>
  )
}

export function ChipsInput({ label, values, onChange, placeholder, max }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; max: number }) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v || values.includes(v) || values.length >= max) { setDraft(''); return }
    onChange([...values, v]); setDraft('')
  }
  return (
    <div className="ha-stack ha-stack--3">
      <div className="ha-ce-chipadd">
        <Field label={label} value={draft} placeholder={placeholder} maxLength={40} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <Button variant="outline" size="sm" icon="add" onClick={add} disabled={values.length >= max}>Adicionar</Button>
      </div>
      <span className="ha-caption">Até {max}. Enter adiciona.</span>
      {values.length ? (
        <div className="ha-ce-chips">
          {values.map((v) => <span key={v} className="ha-ce-chip">{v}<button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><Icon name="close" size={14} /></button></span>)}
        </div>
      ) : null}
    </div>
  )
}

/** Header of a repeatable row: its label and the move/remove buttons. */
export function RowHead({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="ha-ce-row__head">
      <span>{label}</span>
      <span className="ha-ce-item__btns">
        <button type="button" className="ha-ce-icon" aria-label="Subir" disabled={index === 0} onClick={() => onMove(index - 1)}><Icon name="arrow_upward" size={18} /></button>
        <button type="button" className="ha-ce-icon" aria-label="Descer" disabled={index === count - 1} onClick={() => onMove(index + 1)}><Icon name="arrow_downward" size={18} /></button>
        <button type="button" className="ha-ce-icon ha-ce-icon--danger" aria-label="Remover" onClick={onRemove}><Icon name="delete" size={18} /></button>
      </span>
    </div>
  )
}

/** Immutable helpers of a list state. */
export const listOps = {
  set: <T,>(list: T[], i: number, patch: Partial<T>): T[] => list.map((x, j) => (j === i ? { ...x, ...patch } : x)),
  remove: <T,>(list: T[], i: number): T[] => list.filter((_, j) => j !== i),
  move: <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x!)
    return next
  },
}
