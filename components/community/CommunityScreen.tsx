'use client'
// Comunidade (handoff "HouseArt App Colecionador" › Comunidade; "HouseArt App
// Galeria" › Comunidade e eventos; Web: the same feed centred at 680px). The
// feed arrives rendered by the page; the island keeps the reactions optimistic
// and talks to /api/community/* for likes, saves, follows, RSVP, votes and posts.
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import type { FeedItem } from '@/lib/community/server'
import { applyVote, COMMUNITY_TABS, filterTab, reactionTargetOf, sharePathOf, type CommunityTab } from './community-core'
import { FeedCard, type CardActions } from './FeedCard'
import { CommentsSheet } from './CommentsSheet'
import { Composer, type ComposerArtwork } from './Composer'

export function CommunityScreen({ items: initial, tab, me, artworks, compose }: {
  items: FeedItem[]
  tab: CommunityTab
  me: { initials: string; name: string; memberId: number | null }
  artworks: ComposerArtwork[]
  /** The prompt line of the prototype ("Mostre uma obra da sua coleção…" / "Publique uma obra, abertura ou novidade…"). */
  compose: string
}) {
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [commenting, setCommenting] = useState<FeedItem | null>(null)
  const [composing, setComposing] = useState(false)
  const clearToast = useCallback(() => setToast(''), [])

  const patch = (key: string, p: Partial<FeedItem> | ((i: FeedItem) => Partial<FeedItem>)) =>
    setItems((xs) => xs.map((i) => (i.key === key ? { ...i, ...(typeof p === 'function' ? p(i) : p) } : i)))

  async function react(item: FeedItem, target: 'POST' | 'NEWS' | 'EVENT' | 'MEMBER', targetId: number, kind: 'LIKE' | 'SAVE' | 'RSVP' | 'FOLLOW'): Promise<{ on: boolean; count: number } | null> {
    setBusy(item.key)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, targetId, kind }) })
    const data = (await res.json().catch(() => ({}))) as { on?: boolean; count?: number; error?: string }
    setBusy(null)
    if (!res.ok || typeof data.on !== 'boolean') { setToast(data.error ?? 'Não foi possível registrar.'); return null }
    return { on: data.on, count: data.count ?? 0 }
  }

  const actions: CardActions = {
    onLike: async (item) => {
      patch(item.key, (i) => ({ liked: !i.liked, likes: i.likes + (i.liked ? -1 : 1) }))
      const r = await react(item, reactionTargetOf(item), item.id, 'LIKE')
      if (r) patch(item.key, { liked: r.on, likes: r.count }); else patch(item.key, { liked: item.liked, likes: item.likes })
    },
    onSave: async (item) => {
      patch(item.key, (i) => ({ saved: !i.saved }))
      const r = await react(item, reactionTargetOf(item), item.id, 'SAVE')
      if (r) { patch(item.key, { saved: r.on }); setToast(r.on ? 'Post salvo' : 'Post removido dos salvos'); if (!r.on && tab === 'saved') setItems((xs) => xs.filter((i) => i.key !== item.key)) } else patch(item.key, { saved: item.saved })
    },
    onFollow: async (item) => {
      if (item.author.memberId == null) return
      const r = await react(item, 'MEMBER', item.author.memberId, 'FOLLOW')
      if (!r) return
      // Every card of the same author follows the toggle.
      setItems((xs) => xs.map((i) => (i.author.memberId === item.author.memberId ? { ...i, author: { ...i.author, following: r.on } } : i)))
      setToast(r.on ? `Seguindo ${item.author.name}` : `Você deixou de seguir ${item.author.name}`)
    },
    onGoing: async (item) => {
      patch(item.key, (i) => ({ iAmGoing: !i.iAmGoing, going: (i.going ?? 0) + (i.iAmGoing ? -1 : 1) }))
      // An EVENT post is a POST target; only the agenda is an EVENT target.
      const r = await react(item, item.kind === 'AGENDA' ? 'EVENT' : 'POST', item.id, 'RSVP')
      if (r) { patch(item.key, { iAmGoing: r.on, going: r.count }); if (r.on) setToast('Adicionado à sua agenda') } else patch(item.key, { iAmGoing: item.iAmGoing, going: item.going })
    },
    onVote: async (item, option) => {
      if (!item.poll || item.poll.myVote === option) return
      const before = item.poll
      patch(item.key, { poll: applyVote(before, option) })
      setBusy(item.key)
      const res = await fetch(`/api/community/polls/${item.id}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ option }) })
      setBusy(null)
      if (!res.ok) { patch(item.key, { poll: before }); setToast('Não foi possível votar.') }
    },
    onShare: async (item) => {
      const url = `${window.location.origin}${sharePathOf(item)}`
      try { await navigator.clipboard.writeText(url); setToast('Copiado') } catch { setToast(url) }
    },
    onComment: (item) => setCommenting(item),
  }

  /** After publishing: re-read the feed of this tab (no full navigation, the toast stays). */
  async function reload() {
    const api = COMMUNITY_TABS.find((t) => t.key === tab)?.api ?? 'ALL'
    const res = await fetch(`/api/public/community/feed?tab=${api}`)
    const data = (await res.json().catch(() => ({}))) as { items?: FeedItem[] }
    if (res.ok && data.items) setItems(filterTab(data.items, tab))
  }

  const onCount = useCallback((key: string, delta: number) => setItems((xs) => xs.map((i) => (i.key === key ? { ...i, comments: Math.max(0, i.comments + delta) } : i))), [])

  return (
    <div className="ha-cm">
      <div className="ha-cm__head">
        <h1 className="ha-h1">Comunidade</h1>
        <button type="button" className="ha-iconbtn" aria-label="Criar post" onClick={() => setComposing(true)}><Icon name="add_box" size={26} /></button>
      </div>
      <nav className="ha-cm__tabs" aria-label="Abas da comunidade">
        {COMMUNITY_TABS.map((t) => (
          <Link key={t.key} href={t.key === 'foryou' ? '/community' : `/community?tab=${t.key}`} className={`ha-cm__tab${t.key === tab ? ' ha-cm__tab--on' : ''}`} aria-current={t.key === tab ? 'page' : undefined}>{t.label}</Link>
        ))}
      </nav>
      <div className="ha-cm__feed">
        <button type="button" className="ha-cm-prompt" onClick={() => setComposing(true)}>
          <span className="ha-avatar" aria-hidden="true">{me.initials}</span>
          <span className="ha-cm-prompt__hint">{compose}</span>
          <Icon name="add_photo_alternate" size={22} />
        </button>
        {items.map((item) => <FeedCard key={item.key} item={item} actions={actions} busy={busy === item.key} myMemberId={me.memberId} />)}
        {items.length === 0 ? (
          <div className="ha-cm-empty">
            {tab === 'following' ? 'Siga artistas, galerias e colecionadores para ver os posts deles aqui.' : tab === 'saved' ? 'Os posts que você salvar ficam aqui.' : tab === 'events' ? 'Nenhum evento por enquanto.' : tab === 'news' ? 'Nenhuma notícia por enquanto.' : 'Ainda não há posts. Seja a primeira pessoa a publicar.'}
          </div>
        ) : null}
      </div>
      <CommentsSheet key={commenting?.key ?? 'none'} item={commenting} me={me} onClose={() => setCommenting(null)} onCount={onCount} onToast={setToast} />
      <Composer open={composing} artworks={artworks} onClose={() => setComposing(false)} onToast={setToast} onPublished={() => { setComposing(false); setToast('Publicado na comunidade'); void reload() }} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
