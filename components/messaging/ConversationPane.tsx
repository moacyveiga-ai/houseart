'use client'
// "Conversa com galeria" / "Conversa com compradora": header with the other
// side and the artwork strip ("Ver obra"), system lines centred, bubbles (theirs
// paper, mine ink), quick replies, the contact guard before sending and the
// composer. Polls `?after=<lastId>` every 5 s while the tab is visible.
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { CONTACT_GUARD, hasContactLeak, MESSAGE_MAX } from '@/lib/messaging/core'
import { bubbleTime, lastIdOf, mergeMessages, QUICK_REPLIES, type ConversationView, type MessageRole, type MessageView } from './messages-core'

const POLL_MS = 5000

type Loaded = { header: ConversationView; messages: MessageView[] }

export function ConversationPane({ conversationId, role, fallback, onBack, onChanged }: {
  conversationId: number
  role: MessageRole
  /** The row of the list, shown while the conversation loads. */
  fallback: ConversationView | null
  onBack: () => void
  /** The conversation was read or got a new line: the list refreshes its row. */
  onChanged: (header: ConversationView, last: MessageView | null) => void
}) {
  const [data, setDataState] = useState<Loaded | null>(null)
  const dataRef = useRef<Loaded | null>(null)
  const setData = (next: Loaded | null) => { dataRef.current = next; setDataState(next) }
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [guard, setGuard] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const changed = useRef(onChanged)
  useEffect(() => { changed.current = onChanged }, [onChanged])
  const lastId = useRef(0)

  const load = useCallback(async (after: number) => {
    const r = await fetch(`/api/messages/${conversationId}${after ? `?after=${after}` : ''}`, { cache: 'no-store' }).catch(() => null)
    if (!r || !r.ok) { if (after === 0) setError(r?.status === 404 ? 'Conversa não encontrada.' : 'Não foi possível abrir a conversa.'); return }
    const j = (await r.json()) as Loaded
    const cur = dataRef.current
    if (!cur) { lastId.current = lastIdOf(j.messages); setData(j); changed.current(j.header, null); return }
    const messages = mergeMessages(cur.messages, j.messages)
    lastId.current = lastIdOf(messages)
    setData({ header: j.header, messages })
    if (messages !== cur.messages) changed.current(j.header, messages[messages.length - 1] ?? null)
  }, [conversationId])

  // First load, then the 5 s poll while visible.
  useEffect(() => {
    let alive = true
    lastId.current = 0 // the pane is keyed by the conversation id: a new id is a new mount
    const tick = () => { if (!alive || document.visibilityState !== 'visible') return; void load(lastId.current) }
    const first = window.setTimeout(tick, 0)
    const t = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [load])

  // Stick to the bottom when lines arrive.
  const count = data?.messages.length ?? 0
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight }, [count, conversationId, guard])

  const onInput = (v: string) => { setText(v); setGuard(hasContactLeak(v) ? CONTACT_GUARD : null) }

  const send = useCallback(async (raw: string) => {
    const body = raw.trim()
    if (!body || sending) return
    if (hasContactLeak(body)) { setGuard(CONTACT_GUARD); return }
    if (body.length > MESSAGE_MAX) { setGuard(`A mensagem passa de ${MESSAGE_MAX} caracteres.`); return }
    setSending(true); setGuard(null)
    try {
      const r = await fetch(`/api/messages/${conversationId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) })
      const j = (await r.json().catch(() => ({}))) as { message?: MessageView; error?: string; code?: string }
      if (!r.ok || !j.message) { setGuard(j.error ?? 'Não foi possível enviar. Tente de novo.'); return }
      const m = j.message
      setText('')
      const cur = dataRef.current
      if (cur) { const messages = mergeMessages(cur.messages, [m]); lastId.current = lastIdOf(messages); setData({ ...cur, messages }); changed.current(cur.header, m) }
      input.current?.focus()
    } catch { setGuard('Não foi possível enviar. Tente de novo.') } finally { setSending(false) }
  }, [conversationId, sending])

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void send(text) }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text) } }

  const h = data?.header ?? fallback
  return (
    <section className="ha-msg-conv" aria-label={h ? `Conversa com ${h.other.name}` : 'Conversa'}>
      <header className="ha-msg-conv__head">
        <div className="ha-msg-conv__bar">
          <button type="button" className="ha-msg-iconbtn ha-msg-conv__back" onClick={onBack} aria-label="Voltar"><Icon name="arrow_back" size={24} /></button>
          {h ? (
            <>
              <span className="ha-msg-avatar ha-msg-avatar--sm" aria-hidden="true">{h.other.initials}</span>
              <span className="ha-msg-conv__who"><span className="ha-msg-conv__name">{h.other.name}</span><span className="ha-msg-conv__sub">{h.other.sub}</span></span>
            </>
          ) : <span className="ha-msg-conv__who"><span className="ha-msg-conv__name">Conversa</span></span>}
        </div>
        {h?.artworkPublicId ? (
          <Link href={`/e/artwork/${h.artworkPublicId}`} className="ha-msg-conv__art">
            <span className="ha-msg-thumb ha-msg-thumb--sm" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
              {h.artworkCoverUrl ? <img src={h.artworkCoverUrl} alt="" /> : <Icon name="imagesmode" size={18} />}</span>
            <span className="ha-msg-conv__artcol"><i className="ha-msg-conv__arttitle">{h.artworkTitle}</i><span className="ha-msg-conv__artsub">{h.artworkPublicId}</span></span>
            <span className="ha-msg-conv__see"><Icon name="open_in_new" size={16} />Ver obra</span>
          </Link>
        ) : null}
      </header>

      <div className="ha-msg-conv__body" ref={box} role="log" aria-live="polite" aria-busy={!data && !error}>
        {error ? <p className="ha-msg-conv__state">{error}</p> : null}
        {!data && !error ? <p className="ha-msg-conv__state">Abrindo a conversa…</p> : null}
        {data?.messages.length === 0 ? <span className="ha-msg-sys">{h?.artworkTitle ? `Conversa sobre ${h.artworkTitle}` : 'Nova conversa'}</span> : null}
        {data?.messages.map((m) => m.kind === 'TEXT'
          ? <span key={m.id} className={`ha-msg-bubble ${m.mine ? 'ha-msg-bubble--mine' : 'ha-msg-bubble--theirs'}`}><span className="ha-msg-bubble__text">{m.body}</span><span className="ha-msg-bubble__time">{bubbleTime(m.at)}</span></span>
          : <span key={m.id} className="ha-msg-sys">{m.body}</span>)}
      </div>

      <div className="ha-msg-quick" aria-label="Respostas rápidas">
        {QUICK_REPLIES[role].map((q) => <button key={q} type="button" className="ha-msg-quick__chip" disabled={sending || !data} onClick={() => void send(q)}>{q}</button>)}
      </div>
      {guard ? <div className="ha-msg-guard" role="alert"><Icon name="shield" size={17} />{guard}</div> : null}
      <form className="ha-msg-composer" onSubmit={onSubmit}>
        <input ref={input} className="ha-msg-composer__input" value={text} onChange={(e) => onInput(e.target.value)} onKeyDown={onKey} placeholder="Mensagem" aria-label="Mensagem" maxLength={MESSAGE_MAX} disabled={!data} autoComplete="off" />
        <button type="submit" className="ha-msg-composer__send" aria-label="Enviar" disabled={sending || !data || !text.trim() || !!guard}><Icon name="send" size={20} /></button>
      </form>
    </section>
  )
}
