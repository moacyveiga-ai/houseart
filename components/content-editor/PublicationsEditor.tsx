'use client'
// Publicações (artista e galeria): tipo, título, detalhes, preço (vazio = grátis),
// ação do botão, link e capa. O preço é digitado em reais e vai em centavos.
import { Button } from '@/components/ds/Button'
import { Field, SelectField } from '@/components/ds/Field'
import { PUBLICATION_ACTIONS, PUBLICATION_ACTION_LABELS, PUBLICATION_KINDS, PUBLICATION_KIND_LABELS } from '@/lib/public-content/domain'
import { centsFromReais, MAX_PUBLICATIONS, reaisOfCents } from '@/lib/public-content/editor-core'
import { ImageInput, listOps, RowHead } from './parts'

export interface PubForm { kind: string; title: string; meta: string; price: string; action: string; url: string; coverUrl: string | null }
export interface PubRow { kind: string; title: string; meta: string | null; priceCents: string | null; action: string; url: string | null; coverUrl: string | null }

export const pubFormOf = (p: PubRow): PubForm => ({ kind: p.kind, title: p.title, meta: p.meta ?? '', price: reaisOfCents(p.priceCents), action: p.action, url: p.url ?? '', coverUrl: p.coverUrl })

/** The API body of the list, or the first price that does not parse. */
export function pubsBody(list: PubForm[]): { ok: true; value: unknown[] } | { ok: false; error: string } {
  const out: unknown[] = []
  for (const [i, p] of list.entries()) {
    const cents = centsFromReais(p.price)
    if (cents === null) return { ok: false, error: `Publicação ${i + 1} · preço: use o formato 49,90.` }
    out.push({ kind: p.kind, title: p.title, meta: p.meta, priceCents: cents || null, action: p.action, url: p.url, coverUrl: p.coverUrl })
  }
  return { ok: true, value: out }
}

const EMPTY: PubForm = { kind: 'CATALOGUE', title: '', meta: '', price: '', action: 'READ', url: '', coverUrl: null }

export function PublicationsEditor({ value, onChange, uploadUrl }: { value: PubForm[]; onChange: (v: PubForm[]) => void; uploadUrl: string }) {
  return (
    <div className="ha-stack ha-stack--3">
      {value.length ? (
        <ul className="ha-ce-rows">
          {value.map((p, i) => (
            <li key={i} className="ha-ce-row">
              <RowHead label={`Publicação ${i + 1}`} index={i} count={value.length} onMove={(to) => onChange(listOps.move(value, i, to))} onRemove={() => onChange(listOps.remove(value, i))} />
              <div className="ha-ce-grid">
                <SelectField label="Tipo" value={p.kind} onChange={(e) => onChange(listOps.set(value, i, { kind: e.target.value }))}>
                  {PUBLICATION_KINDS.map((k) => <option key={k} value={k}>{PUBLICATION_KIND_LABELS[k]}</option>)}
                </SelectField>
                <Field label="Título" value={p.title} maxLength={200} required onChange={(e) => onChange(listOps.set(value, i, { title: e.target.value }))} />
                <Field label="Detalhes" value={p.meta} maxLength={120} placeholder="96 páginas · PDF e ePub" onChange={(e) => onChange(listOps.set(value, i, { meta: e.target.value }))} />
                <Field label="Preço (R$)" value={p.price} inputMode="decimal" placeholder="Vazio = grátis" onChange={(e) => onChange(listOps.set(value, i, { price: e.target.value }))} />
                <SelectField label="Botão" value={p.action} onChange={(e) => onChange(listOps.set(value, i, { action: e.target.value }))}>
                  {PUBLICATION_ACTIONS.map((a) => <option key={a} value={a}>{PUBLICATION_ACTION_LABELS[a].label}</option>)}
                </SelectField>
                <Field label="Link" type="url" value={p.url} maxLength={500} placeholder="https://…" onChange={(e) => onChange(listOps.set(value, i, { url: e.target.value }))} />
                <div className="ha-ce-span"><ImageInput label="Capa" value={p.coverUrl} uploadUrl={uploadUrl} onChange={(url) => onChange(listOps.set(value, i, { coverUrl: url }))} /></div>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="ha-ce__empty">Nenhuma publicação.</p>}
      <div><Button variant="outline" size="sm" icon="add" disabled={value.length >= MAX_PUBLICATIONS} onClick={() => onChange([...value, { ...EMPTY }])}>Adicionar publicação</Button></div>
    </div>
  )
}
