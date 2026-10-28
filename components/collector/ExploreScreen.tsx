'use client'
// Explorar (handoff "HouseArt App Colecionador" › Explorar · feed and Explorar · descobrir;
// the Web Colecionador shows the same column inside the shell). Only the feed: Descobrir (the deck)
// left the web on 2026-10-28 (Moacy); the search and favorites sit on the row of the chips.
// the chips of `CATS`, the feed of large cards (seller head · wall with "Certificada" and
// "Aceita ofertas" · curtir / enviar / salvar · artist, title, sheet · price with Ofertar /
// Comprar). Reactions by POST /api/community/reactions.
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { ShareSheet } from '@/components/public/ShareSheet'
import { categoryLabel, formatBRL } from '@/lib/artworks/domain'
import { installmentCents } from '@/lib/shipping/quote-core'
import { CommentsSheet, type CommentSubject } from '@/components/community/CommentsSheet'
import { acceptsOffers, exploreHref, exploreWorkHref, marketLabel, sellerSubOf, sheetLineOf, EXPLORE_CHIPS, type ExploreChip, type ExploreItem, type ExploreView } from './explore-core'
import './explore.css'

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
const priceOf = (cents: string | null) => (cents === null ? 'Sob consulta' : formatBRL(BigInt(cents)))
const installmentOf = (cents: string | null) => (cents === null ? 'O preço não aparece: interessados pedem contato.' : `ou 10× de ${formatBRL(installmentCents(Number(cents)))} sem juros`)

type Kind = 'LIKE' | 'SAVE'

export function ExploreScreen({ items: initial, view, chip, me }: { items: ExploreItem[]; view: ExploreView; chip: ExploreChip; me: { initials: string; avatarUrl?: string | null } }) {
  const [items, setItems] = useState(initial)
  const workHref = (publicId: string) => exploreWorkHref(view, chip, publicId)
  const [toast, setToast] = useState('')
  const [sharing, setSharing] = useState<ExploreItem | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [commenting, setCommenting] = useState<CommentSubject | null>(null)
  const clearToast = useCallback(() => setToast(''), [])

  const patch = (id: number, p: Partial<ExploreItem>) => setItems((xs) => xs.map((i) => (i.id === id ? { ...i, ...p } : i)))

  /** Toggle like/save with optimistic flip; the server is the authority (rolls back on error). */
  async function react(item: ExploreItem, kind: Kind, quiet = false): Promise<boolean> {
    const key = kind === 'LIKE' ? 'liked' : 'saved'
    const before = item[key]
    patch(item.id, kind === 'LIKE' ? { liked: !before, likes: Math.max(0, item.likes + (before ? -1 : 1)) } : { saved: !before })
    setBusy(item.id)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'ARTWORK', targetId: item.id, kind }) })
    setBusy(null)
    if (!res.ok) { patch(item.id, kind === 'LIKE' ? { liked: before, likes: item.likes } : { saved: before }); setToast('Não foi possível registrar agora.'); return false }
    const data = (await res.json().catch(() => ({}))) as { on?: boolean; count?: number }
    patch(item.id, kind === 'LIKE' ? { liked: !!data.on, ...(typeof data.count === 'number' ? { likes: data.count } : {}) } : { saved: !!data.on })
    if (!quiet) setToast(kind === 'SAVE' ? (data.on ? 'Salva nos favoritos' : 'Removida dos favoritos') : data.on ? 'Curtida' : 'Curtida removida')
    return !!data.on
  }

  return (
    <div className="ha-explore">
      <div className="ha-explore__head">
        {/* the prototype has no title over the feed; the page keeps one for screen readers */}
        <h1 className="ha-sr">Explorar</h1>
        <div className="ha-explore__chips" aria-label="Categorias">
          {EXPLORE_CHIPS.map((c) => <Link key={c.key} href={exploreHref(view, c.key)} className={`ha-chip${chip === c.key ? ' ha-chip--on' : ''}`} aria-current={chip === c.key ? 'page' : undefined}>{c.label}</Link>)}
        </div>
        <Link href="/search" className="ha-iconbtn ha-explore__ic" aria-label="Buscar"><Icon name="search" size={24} /></Link>
        <Link href="/favorites" className="ha-iconbtn ha-explore__ic" aria-label="Favoritos"><Icon name="bookmark" size={24} /></Link>
      </div>

        <div className="ha-explore__feed">
          {items.map((o) => {
            const offers = acceptsOffers(o.saleMode)
            return (
              <article key={o.id} className="ha-xp-post" aria-label={o.title}>
                <div className="ha-xp-post__by">
                  {o.sellerHref ? (
                    <Link href={o.sellerHref} className="ha-xp-post__seller">
                      <span className="ha-avatar ha-xp-post__av" aria-hidden="true">{initialsOf(o.seller)}</span>
                      <span className="ha-stack ha-xp-post__who"><span className="ha-xp-post__name">{o.seller}</span><span className="ha-xp-post__sub">{sellerSubOf(o)}</span></span>
                    </Link>
                  ) : (
                    <span className="ha-xp-post__seller">
                      <span className="ha-avatar ha-xp-post__av" aria-hidden="true">{initialsOf(o.seller)}</span>
                      <span className="ha-stack ha-xp-post__who"><span className="ha-xp-post__name">{o.seller}</span><span className="ha-xp-post__sub">{sellerSubOf(o)}</span></span>
                    </span>
                  )}
                  <span className="ha-xp-post__pill">{marketLabel(o.market)}</span>
                </div>
                <Link href={workHref(o.publicId)} scroll={false} className="ha-xp-post__wall" aria-label={`Ver obra ${o.title}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {o.cover ? <img src={o.cover} alt={o.title} loading="lazy" /> : null}
                  <span className="ha-xp-post__badges">
                    <span className="ha-xp-post__cert"><Icon name="verified" size={14} filled />Certificada</span>
                    {offers ? <span className="ha-xp-post__offers">Aceita ofertas</span> : null}
                  </span>
                </Link>
                <div className="ha-xp-post__acts">
                  <button type="button" className={`ha-xp-act${o.liked ? ' ha-xp-act--liked' : ''}`} aria-label={o.liked ? 'Remover curtida' : 'Curtir'} aria-pressed={o.liked} disabled={busy === o.id} onClick={() => react(o, 'LIKE')}><Icon name="favorite" size={24} filled={o.liked} />{o.likes > 0 ? <span className="ha-xp-act__n">{o.likes}</span> : null}</button>
                  <button type="button" className="ha-xp-act" aria-label={`Comentários (${o.comments})`} onClick={() => setCommenting({ key: `a${o.id}`, id: o.id, target: 'ARTWORK', author: { memberId: null, name: o.seller } })}><Icon name="chat_bubble" size={24} />{o.comments > 0 ? <span className="ha-xp-act__n">{o.comments}</span> : null}</button>
                  <button type="button" className="ha-xp-act" aria-label="Compartilhar" onClick={() => setSharing(o)}><Icon name="send" size={24} /></button>
                  <span className="ha-xp-post__sp" />
                  <button type="button" className="ha-xp-act" aria-label={o.saved ? 'Remover dos favoritos' : 'Salvar'} aria-pressed={o.saved} disabled={busy === o.id} onClick={() => react(o, 'SAVE')}><Icon name="bookmark" size={24} filled={o.saved} /></button>
                </div>
                <Link href={workHref(o.publicId)} scroll={false} className="ha-xp-post__cap">
                  <span className="ha-xp-post__artist">{o.artist}</span>
                  <i className="ha-xp-post__title">{o.title}{o.year ? `, ${o.year}` : ''}</i>
                  <span className="ha-xp-post__sheet">{sheetLineOf(o, categoryLabel(o.category))}</span>
                </Link>
                <div className="ha-xp-post__buy">
                  <span className="ha-stack ha-xp-post__price"><span className="ha-xp-post__v">{priceOf(o.priceCents)}</span><span className="ha-xp-post__inst">{installmentOf(o.priceCents)}</span></span>
                  {offers ? <Link href={`/e/artwork/${o.publicId}/offer`} className="ha-btn ha-btn--outline ha-btn--sm">Ofertar</Link> : null}
                  {o.priceCents !== null ? <Link href={`/e/artwork/${o.publicId}/buy`} className="ha-btn ha-btn--primary ha-btn--sm">Comprar</Link> : null}
                </div>
              </article>
            )
          })}
          {items.length === 0 ? <div className="ha-explore__empty">Nenhuma obra nesta categoria agora.</div> : null}
          <div className="ha-explore__foot">Todas as obras têm certificado assinado e etiqueta no verso.</div>
        </div>

      {sharing ? <ShareSheet artwork={{ publicId: sharing.publicId, title: sharing.title, artist: sharing.artist, year: sharing.year, cover: sharing.cover, price: sharing.priceCents === null ? null : priceOf(sharing.priceCents) }} open onClose={() => setSharing(null)} onDone={setToast} /> : null}
      <CommentsSheet key={commenting?.key ?? 'none'} item={commenting} me={me} onClose={() => setCommenting(null)} onToast={setToast}
        onCount={(key, delta) => setItems((xs) => xs.map((i) => (`a${i.id}` === key ? { ...i, comments: Math.max(0, i.comments + delta) } : i)))} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
