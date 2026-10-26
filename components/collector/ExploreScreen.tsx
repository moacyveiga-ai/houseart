'use client'
// Explorar (handoff "HouseArt App Colecionador" › Explorar · feed and Explorar · descobrir;
// the Web Colecionador shows the same column inside the shell): segmented Feed · Descobrir,
// the chips of `CATS`, the feed of large cards (seller head · wall with "Certificada" and
// "Aceita ofertas" · curtir / enviar / salvar · artist, title, sheet · price with Ofertar /
// Comprar) and the deck of Descobrir (one card, drag right to like, left to pass; buttons
// Passar · Salvar · Curtir · Ver obra). Reactions by POST /api/community/reactions.
import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { ShareSheet } from '@/components/public/ShareSheet'
import { categoryLabel, formatBRL } from '@/lib/artworks/domain'
import { installmentCents } from '@/lib/shipping/quote-core'
import { CommentsSheet, type CommentSubject } from '@/components/community/CommentsSheet'
import { acceptsOffers, deckCounter, discoverOrder, exploreHref, likedNote, exploreWorkHref, marketLabel, sellerSubOf, sheetLineOf, EXPLORE_CHIPS, type ExploreChip, type ExploreItem, type ExploreView } from './explore-core'
import './explore.css'

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
const priceOf = (cents: string | null) => (cents === null ? 'Sob consulta' : formatBRL(BigInt(cents)))
const installmentOf = (cents: string | null) => (cents === null ? 'O preço não aparece: interessados pedem contato.' : `ou 10× de ${formatBRL(installmentCents(Number(cents)))} sem juros`)

type Kind = 'LIKE' | 'SAVE'

export function ExploreScreen({ items: initial, view, chip, me }: { items: ExploreItem[]; view: ExploreView; chip: ExploreChip; me: { initials: string } }) {
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
        <div className="ha-explore__top">
          {/* the prototype has no title over the feed; the page keeps one for screen readers */}
          <h1 className="ha-sr">Explorar</h1>
          <span className="ha-explore__sp" />
          <Link href="/search" className="ha-iconbtn ha-explore__ic" aria-label="Buscar"><Icon name="search" size={24} /></Link>
          <Link href="/favorites" className="ha-iconbtn ha-explore__ic" aria-label="Favoritos"><Icon name="bookmark" size={24} /></Link>
        </div>
        <div className="ha-explore__seg" role="tablist" aria-label="Modo">
          <Link href={exploreHref('feed', chip)} role="tab" aria-selected={view === 'feed'} className={`ha-explore__seg-b${view === 'feed' ? ' ha-explore__seg-b--on' : ''}`}>Feed</Link>
          <Link href={exploreHref('discover', chip)} role="tab" aria-selected={view === 'discover'} className={`ha-explore__seg-b${view === 'discover' ? ' ha-explore__seg-b--on' : ''}`}>Descobrir</Link>
        </div>
        <div className="ha-explore__chips" aria-label="Categorias">
          {EXPLORE_CHIPS.map((c) => <Link key={c.key} href={exploreHref(view, c.key)} className={`ha-chip${chip === c.key ? ' ha-chip--on' : ''}`} aria-current={chip === c.key ? 'page' : undefined}>{c.label}</Link>)}
        </div>
      </div>

      {view === 'feed' ? (
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
      ) : (
        <DiscoverDeck items={items} react={react} onShare={setSharing} workHref={workHref} />
      )}

      {sharing ? <ShareSheet artwork={{ publicId: sharing.publicId, title: sharing.title, artist: sharing.artist, year: sharing.year, cover: sharing.cover, price: sharing.priceCents === null ? null : priceOf(sharing.priceCents) }} open onClose={() => setSharing(null)} onDone={setToast} /> : null}
      <CommentsSheet key={commenting?.key ?? 'none'} item={commenting} me={me} onClose={() => setCommenting(null)} onToast={setToast}
        onCount={(key, delta) => setItems((xs) => xs.map((i) => (`a${i.id}` === key ? { ...i, comments: Math.max(0, i.comments + delta) } : i)))} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}

/** Descobrir: the deck. Decisions live in this screen (the prototype's `dec`); like and save go to the server. */
function DiscoverDeck({ items, react, onShare, workHref }: { items: ExploreItem[]; react: (item: ExploreItem, kind: Kind, quiet?: boolean) => Promise<boolean>; onShare: (item: ExploreItem) => void; workHref: (publicId: string) => string }) {
  const [decided, setDecided] = useState<Record<number, true>>({})
  const [drag, setDrag] = useState<number | null>(null)
  const [fly, setFly] = useState<0 | 1 | -1 | 2>(0)
  const start = useRef<number | null>(null)
  const [order] = useState(() => discoverOrder(items).map((i) => i.id))
  const note = useMemo(() => likedNote(items), [items])
  const ordered = useMemo(() => order.map((id) => items.find((i) => i.id === id)).filter((i): i is ExploreItem => !!i), [order, items])
  const deck = ordered.filter((i) => !decided[i.id])
  const top = deck[0]
  const total = ordered.length

  function decide(kind: 'pass' | 'like' | 'save') {
    if (!top || fly) return
    const item = top
    setFly(kind === 'pass' ? -1 : kind === 'like' ? 1 : 2)
    if (kind === 'like' && !item.liked) void react(item, 'LIKE', true)
    if (kind === 'save' && !item.saved) void react(item, 'SAVE')
    window.setTimeout(() => { setDecided((d) => ({ ...d, [item.id]: true })); setFly(0); setDrag(null) }, 240)
  }
  const onDown = (e: React.PointerEvent) => { if (fly) return; start.current = e.clientX; setDrag(0); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (start.current === null || fly) return; setDrag(e.clientX - start.current) }
  const onUp = () => {
    if (start.current === null) return
    const dx = drag ?? 0; start.current = null
    if (dx > 90) decide('like'); else if (dx < -90) decide('pass'); else setDrag(null)
  }
  const dx = fly ? (fly === 2 ? 0 : fly * 420) : drag ?? 0
  const dy = fly === 2 ? -600 : 0
  const style = { transform: `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`, transition: drag !== null && !fly ? 'none' : 'transform var(--ha-dur-panel) var(--ha-ease)' }

  if (!top) {
    return (
      <div className="ha-deck ha-deck--empty">
        <Icon name="style" size={36} className="ha-deck__empty-ic" />
        <span className="ha-deck__empty-t">Você viu todas as obras de hoje.</span>
        <span className="ha-deck__empty-s">As curtidas e as salvas estão nos seus favoritos. Novas obras entram toda manhã.</span>
        <div className="ha-row"><Link href="/favorites" className="ha-btn ha-btn--primary ha-btn--md">Ver salvas</Link><button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setDecided({})}>Recomeçar</button></div>
      </div>
    )
  }
  return (
    <div className="ha-deck">
      <div className="ha-deck__stage">
        <div className="ha-deck__card" style={style} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="ha-deck__wall">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            {top.cover ? <img src={top.cover} alt={top.title} draggable={false} /> : null}
            <span className="ha-deck__stamp ha-deck__stamp--pass" style={{ opacity: Math.max(0, Math.min(1, -dx / 90)) }}>Passar</span>
            <span className="ha-deck__stamp ha-deck__stamp--like" style={{ opacity: Math.max(0, Math.min(1, dx / 90)) }}>Curtir</span>
          </div>
          <div className="ha-deck__cap">
            <span className="ha-xp-post__artist">{top.artist}</span>
            <i className="ha-deck__title">{top.title}{top.year ? `, ${top.year}` : ''}</i>
            <span className="ha-xp-post__sheet">{sheetLineOf(top, categoryLabel(top.category))}</span>
            <span className="ha-deck__row"><span className="ha-xp-post__v">{priceOf(top.priceCents)}</span><span className="ha-xp-post__sub">{top.seller}</span></span>
          </div>
        </div>
      </div>
      <div className="ha-deck__btns">
        <button type="button" className="ha-deck__b ha-deck__b--lg" aria-label="Passar" onClick={() => decide('pass')}><Icon name="close" size={28} /></button>
        <button type="button" className="ha-deck__b" aria-label="Salvar" onClick={() => decide('save')}><Icon name="bookmark" size={22} /></button>
        <button type="button" className="ha-deck__b ha-deck__b--lg ha-deck__b--ink" aria-label="Curtir" onClick={() => decide('like')}><Icon name="favorite" size={28} filled /></button>
        <Link href={workHref(top.publicId)} scroll={false} className="ha-deck__b" aria-label="Ver obra"><Icon name="open_in_full" size={22} /></Link>
        <button type="button" className="ha-deck__b" aria-label="Compartilhar" onClick={() => onShare(top)}><Icon name="send" size={22} /></button>
      </div>
      <span className="ha-deck__count">{deckCounter(total - deck.length, total)}</span>
      {note ? <span className="ha-deck__note">{note}</span> : null}
    </div>
  )
}
