'use client'
// Comentários (handoff "HouseArt App Colecionador" › sheet "Comentários"): the
// list with the "autor" badge, "Responder" (prefills @name), like per comment,
// and the composer with the contact guard of the prototype.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { hasContactLeak } from '@/lib/messaging/core'
import type { CommentRow, FeedItem } from '@/lib/community/server'
import type { CommentTarget } from '@/lib/community/domain'

export const COMMENT_GUARD = 'Telefones, e-mails e links não podem ser publicados. Negocie pelas mensagens da HouseArt.'

/** What can be commented: a feed item (post, news) or a public artwork (target ARTWORK, author = who sells it). */
export interface CommentSubject { key: string; id: number; kind?: FeedItem['kind']; target?: CommentTarget; author: { memberId: number | null; name: string } }

const target = (item: CommentSubject): CommentTarget => item.target ?? (item.kind === 'NEWS' ? 'NEWS' : 'POST')

async function fetchComments(it: CommentSubject): Promise<CommentRow[]> {
  const res = await fetch(`/api/public/community/comments?target=${target(it)}&targetId=${it.id}`)
  const data = (await res.json().catch(() => ({}))) as { items?: CommentRow[] }
  return res.ok && data.items ? data.items : []
}

export function CommentsSheet({ item, me, onClose, onCount, onToast }: {
  item: CommentSubject | null
  me: { initials: string }
  onClose: () => void
  /** The feed card keeps its counter in step with the sheet. */
  onCount: (key: string, delta: number) => void
  onToast: (m: string) => void
}) {
  const [rows, setRows] = useState<CommentRow[] | null>(null)
  const [text, setText] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liking = useRef(new Set<number>())

  // The parent remounts the sheet per item (`key`), so state starts clean; only the load runs here.
  useEffect(() => {
    if (!item) return
    let alive = true
    fetchComments(item).then((rows) => { if (alive) setRows(rows) })
    return () => { alive = false }
  }, [item])

  if (!item) return null
  const it = item
  // the server decides who is the author of the thread (never by the name, which anyone can copy)
  const isAuthor = (c: CommentRow) => c.byOwner

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    if (hasContactLeak(body)) { setBlocked(true); return }
    setSending(true)
    const res = await fetch('/api/community/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target(it), targetId: it.id, body }) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setSending(false)
    if (!res.ok) { onToast(data.error ?? 'Não foi possível comentar.'); return }
    setText(''); setBlocked(false)
    onCount(it.key, 1)
    setRows(await fetchComments(it))
  }

  async function like(c: CommentRow) {
    if (liking.current.has(c.id)) return
    liking.current.add(c.id)
    setRows((rs) => rs?.map((r) => (r.id === c.id ? { ...r, liked: !r.liked, likes: r.likes + (r.liked ? -1 : 1) } : r)) ?? rs)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'COMMENT', targetId: c.id, kind: 'LIKE' }) })
    liking.current.delete(c.id)
    if (!res.ok) { setRows((rs) => rs?.map((r) => (r.id === c.id ? { ...r, liked: c.liked, likes: c.likes } : r)) ?? rs); onToast('Não foi possível curtir.') }
  }

  async function remove(c: CommentRow) {
    const res = await fetch(`/api/community/comments/${c.id}`, { method: 'DELETE' })
    if (!res.ok) { onToast('Não foi possível apagar.'); return }
    setRows((rs) => rs?.filter((r) => r.id !== c.id) ?? rs)
    onCount(it.key, -1)
  }

  function reply(c: CommentRow) {
    setText(`@${c.author.name.split(' ')[0]} `)
    inputRef.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); void send() } }

  return (
    <Modal open title="Comentários" onClose={onClose}>
      <div className="ha-cm-comments">
        <div className="ha-cm-comments__list">
          {rows === null ? <div className="ha-cm-empty">Carregando…</div> : null}
          {rows && rows.length === 0 ? <div className="ha-cm-empty">Seja a primeira pessoa a comentar.</div> : null}
          {rows?.map((c) => (
            <div key={c.id} className="ha-cm-comment">
              <span className="ha-avatar" aria-hidden="true">{c.mine ? me.initials : c.author.initials}</span>
              <div className="ha-cm-comment__body">
                <span className="ha-cm-comment__name">{c.mine ? 'Você' : c.author.profileHref ? <a href={c.author.profileHref} className="ha-cm-post__namelink">{c.author.name}</a> : c.author.name}{isAuthor(c) ? <span className="ha-cm-comment__author">autor</span> : null}<span className="ha-cm-comment__when">{c.when}</span></span>
                <span className="ha-cm-comment__text">{c.body}</span>
                <span className="ha-cm-comment__links">
                  <button type="button" className="ha-cm-comment__link" onClick={() => reply(c)}>Responder</button>
                  {c.canDelete ? <button type="button" className="ha-cm-comment__link" onClick={() => remove(c)}>Apagar</button> : null}
                </span>
              </div>
              <button type="button" className={`ha-cm-comment__like${c.liked ? ' ha-cm-comment__like--on' : ''}`} aria-label={c.liked ? 'Descurtir comentário' : 'Curtir comentário'} aria-pressed={c.liked} onClick={() => like(c)}><Icon name="favorite" filled={c.liked} /></button>
            </div>
          ))}
        </div>
        {blocked ? <div className="ha-cm-guard" role="alert">{COMMENT_GUARD}</div> : null}
        <div className="ha-cm-composer">
          <span className="ha-avatar" aria-hidden="true">{me.initials}</span>
          <input ref={inputRef} className="ha-cm-composer__input" value={text} onChange={(e) => { setText(e.target.value); setBlocked(false) }} onKeyDown={onKey} placeholder="Adicione um comentário" aria-label="Adicione um comentário" maxLength={500} />
          <button type="button" className="ha-cm-composer__send" disabled={!text.trim() || sending} onClick={() => send()}>Publicar</button>
        </div>
      </div>
    </Modal>
  )
}
