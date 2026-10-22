'use client'
// Novo post (handoff "HouseArt App Colecionador" › sheet "Novo post"): the text,
// the optional artwork of the collection, and — beyond the prototype, which only
// wrote photo/text — the poll and the event the API also takes.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { hasContactLeak } from '@/lib/messaging/core'
import { POLL_OPTIONS_MAX } from '@/lib/community/domain'
import { COMPOSER_KINDS, draftPayload, draftReady, EMPTY_DRAFT, type ComposerDraft, type ComposerKind } from './community-core'

export interface ComposerArtwork { id: number; title: string; coverUrl: string | null }

export function Composer({ open, artworks, onClose, onPublished, onToast }: {
  open: boolean
  artworks: ComposerArtwork[]
  onClose: () => void
  onPublished: () => void
  onToast: (m: string) => void
}) {
  const [d, setD] = useState<ComposerDraft>(EMPTY_DRAFT)
  const [sending, setSending] = useState(false)
  const set = (p: Partial<ComposerDraft>) => setD((x) => ({ ...x, ...p }))
  const ready = draftReady(d)
  const showArtworks = (d.kind === 'TEXT' || d.kind === 'PHOTO') && artworks.length > 0

  function close() { setD(EMPTY_DRAFT); onClose() }

  async function publish() {
    if (!ready || sending) return
    const text = [d.body, ...d.pollOptions, d.event.title, d.event.venue].join('\n')
    if (hasContactLeak(text)) { onToast('Tire telefones, e-mails e links para publicar'); return }
    setSending(true)
    const res = await fetch('/api/community/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draftPayload(d)) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setSending(false)
    if (!res.ok) { onToast(data.error ?? 'Não foi possível publicar.'); return }
    setD(EMPTY_DRAFT)
    onPublished()
  }

  const kindLabel = (k: ComposerKind) => COMPOSER_KINDS.find((c) => c.key === k)!.label

  return (
    <Modal open={open} title="Novo post" onClose={close}>
      <div className="ha-cm-new">
        <div className="ha-cm-new__kinds" role="radiogroup" aria-label="Tipo de post">
          {COMPOSER_KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={d.kind === k.key} className={`ha-chip${d.kind === k.key ? ' ha-chip--on' : ''}`} onClick={() => set({ kind: k.key })}><Icon name={k.icon} size={16} /> {k.label}</button>
          ))}
        </div>

        {d.kind !== 'EVENT' ? (
          <textarea className="ha-cm-new__textarea" rows={4} value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={1500} aria-label={d.kind === 'POLL' ? 'Pergunta da enquete' : 'Texto do post'}
            placeholder={d.kind === 'POLL' ? 'Qual é a pergunta?' : 'Conte a história de uma obra, mostre a parede de casa, pergunte à comunidade…'} />
        ) : null}

        {d.kind === 'PHOTO' ? (
          <label className="ha-cm-new__label">URL da imagem <span className="ha-muted">· ou marque uma obra</span>
            <input className="ha-input" value={d.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" inputMode="url" />
          </label>
        ) : null}

        {showArtworks ? (
          <>
            <span className="ha-cm-new__label">Marcar uma obra da sua coleção · {d.kind === 'PHOTO' ? 'ou a URL acima' : 'opcional'}</span>
            <div className="ha-cm-new__artworks" role="listbox" aria-label="Obras">
              {artworks.map((a) => (
                <button key={a.id} type="button" role="option" aria-selected={d.artworkId === a.id} className={`ha-cm-new__art${d.artworkId === a.id ? ' ha-cm-new__art--on' : ''}`} onClick={() => set({ artworkId: d.artworkId === a.id ? null : a.id })}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                  <span className="ha-cm-new__art-wall">{a.coverUrl ? <img src={a.coverUrl} alt="" /> : <Icon name="imagesmode" size={28} />}</span>
                  <span className="ha-cm-new__art-title">{a.title}</span>
                </button>
              ))}
            </div>
            <span className="ha-cm-new__hint">Obras marcadas mostram o certificado. Se estiver à venda, o post leva direto à página da obra.</span>
          </>
        ) : null}
        {(d.kind === 'TEXT' || d.kind === 'PHOTO') && artworks.length === 0 ? <span className="ha-cm-new__hint">Obras autenticadas da sua coleção aparecem aqui para marcar no post.</span> : null}

        {d.kind === 'POLL' ? (
          <>
            <span className="ha-cm-new__label">Opções · de 2 a {POLL_OPTIONS_MAX}</span>
            {d.pollOptions.map((o, i) => (
              <input key={i} className="ha-input" value={o} maxLength={40} aria-label={`Opção ${i + 1}`} placeholder={`Opção ${i + 1}`} onChange={(e) => set({ pollOptions: d.pollOptions.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
            {d.pollOptions.length < POLL_OPTIONS_MAX ? <button type="button" className="ha-btn ha-btn--outline ha-btn--xs" onClick={() => set({ pollOptions: [...d.pollOptions, ''] })}><Icon name="add" size={18} />Mais uma opção</button> : null}
          </>
        ) : null}

        {d.kind === 'EVENT' ? (
          <>
            <label className="ha-cm-new__label">Título<input className="ha-input" value={d.event.title} maxLength={120} onChange={(e) => set({ event: { ...d.event, title: e.target.value } })} placeholder="Abertura · nome da mostra" /></label>
            <label className="ha-cm-new__label">Local<input className="ha-input" value={d.event.venue} maxLength={160} onChange={(e) => set({ event: { ...d.event, venue: e.target.value } })} placeholder="Galeria, endereço ou cidade" /></label>
            <div className="ha-cm-new__row">
              <label className="ha-cm-new__label">Data<input className="ha-input" type="date" value={d.event.startsOn} onChange={(e) => set({ event: { ...d.event, startsOn: e.target.value } })} /></label>
              <label className="ha-cm-new__label">Horário · opcional<input className="ha-input" value={d.event.startsAt} maxLength={10} onChange={(e) => set({ event: { ...d.event, startsAt: e.target.value } })} placeholder="19h" /></label>
            </div>
            <textarea className="ha-cm-new__textarea" rows={3} value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={1500} aria-label="Convite" placeholder="Convite aos seguidores · opcional" />
          </>
        ) : null}

        <button type="button" className={`ha-cm-new__publish${ready ? ' ha-cm-new__publish--ready' : ''}`} aria-disabled={!ready} disabled={sending} onClick={publish}>
          {sending ? 'Publicando…' : `Publicar ${d.kind === 'TEXT' ? 'na comunidade' : kindLabel(d.kind).toLowerCase()}`}
        </button>
      </div>
    </Modal>
  )
}
