'use client'
// "Mensagens": the list (search by person or artwork, unread pill) and, from
// 1024 px, the open conversation at the right (Web Colecionador / Web Galeria);
// under that the conversation takes the screen (the apps). The open id lives
// in the URL (/messages/<id>) by pushState, so the two pages share this island.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { ConversationPane } from './ConversationPane'
import { conversationIdOfPath, touchRow, type ConversationView, type MessageRole, type MessageView } from './messages-core'
import { previewOf } from '@/lib/messaging/core'

const LIST_POLL_MS = 15000

export function MessagesScreen({ initialRows, initialConversationId, role }: { initialRows: ConversationView[]; initialConversationId: number | null; role: MessageRole }) {
  const [rows, setRows] = useState(initialRows)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number | null>(initialConversationId)
  const qRef = useRef(q)

  const refresh = useCallback(async (query: string) => {
    qRef.current = query
    const r = await fetch(`/api/messages${query ? `?q=${encodeURIComponent(query)}` : ''}`, { cache: 'no-store' })
    if (!r.ok || qRef.current !== query) return
    const j = (await r.json()) as { items: ConversationView[] }
    setRows(j.items)
  }, [])

  // Search (debounced) and a slow poll of the list while visible.
  useEffect(() => { const t = window.setTimeout(() => { refresh(q).catch(() => {}) }, q ? 250 : 0); return () => window.clearTimeout(t) }, [q, refresh])
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh(qRef.current).catch(() => {}) }
    const t = window.setInterval(tick, LIST_POLL_MS)
    return () => window.clearInterval(t)
  }, [refresh])

  // URL ↔ selection (back/forward included).
  useEffect(() => {
    const sync = () => setSelected(conversationIdOfPath(window.location.pathname))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const open = (id: number | null) => {
    setSelected(id)
    const href = id ? `/messages/${id}` : '/messages'
    if (window.location.pathname !== href) window.history.pushState(null, '', href)
  }

  const onChanged = useCallback((header: ConversationView, last: MessageView | null) => {
    setRows((cur) => touchRow(cur, header, last ? { preview: previewOf(last.body, last.mine, last.kind), when: 'agora' } : {}))
  }, [])

  const current = selected ? rows.find((r) => r.id === selected) ?? null : null
  return (
    <div className={`ha-msg${selected ? ' ha-msg--open' : ''}`}>
      <section className="ha-msg-list" aria-label="Conversas">
        <div className="ha-msg-list__head">
          <h1 className="ha-msg-list__title">Mensagens</h1>
          <label className="ha-msg-search"><Icon name="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por pessoa ou obra" aria-label="Buscar por pessoa ou obra" /></label>
        </div>
        <div className="ha-msg-list__rows">
          {rows.map((c) => (
            <button key={c.id} type="button" className={`ha-msg-row${c.unread ? ' ha-msg-row--unread' : ''}${c.id === selected ? ' ha-msg-row--on' : ''}`} onClick={() => open(c.id)} aria-current={c.id === selected ? 'true' : undefined}>
              <span className="ha-msg-row__pic">
                <span className="ha-msg-thumb" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                  {c.artworkCoverUrl ? <img src={c.artworkCoverUrl} alt="" /> : <Icon name="person" size={22} />}</span>
                <span className="ha-msg-avatar ha-msg-avatar--badge" aria-hidden="true">{c.other.initials}</span>
              </span>
              <span className="ha-msg-row__col">
                <span className="ha-msg-row__top"><span className="ha-msg-row__name">{c.other.name}</span><span className="ha-msg-row__when">{c.when}</span></span>
                <i className="ha-msg-row__art">{c.artworkTitle ?? c.other.sub}</i>
                <span className="ha-msg-row__bottom"><span className="ha-msg-row__preview">{c.preview}</span>{c.unread ? <span className="ha-msg-row__unread" aria-label={`${c.unread} não lidas`}>{c.unread}</span> : null}</span>
              </span>
            </button>
          ))}
          {rows.length === 0 ? <div className="ha-msg-list__empty">{q ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda. Toque em "Falar com a galeria" na página de uma obra para começar.'}</div> : null}
        </div>
      </section>
      {selected ? (
        <ConversationPane key={selected} conversationId={selected} role={role} fallback={current} onBack={() => open(null)} onChanged={onChanged} />
      ) : (
        <section className="ha-msg-conv ha-msg-conv--empty" aria-label="Nenhuma conversa aberta"><Icon name="chat_bubble" size={32} /><p>Escolha uma conversa à esquerda.</p></section>
      )}
    </div>
  )
}
