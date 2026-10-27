'use client'
// One card of the feed (handoff "HouseArt App Colecionador" › Comunidade): author
// head with the person tag and "Seguir", the body by kind (photo with the
// artwork line, text, news, poll, event/agenda) and the action row
// (curtir · comentar · compartilhar · salvar).
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { AvatarFace } from '@/components/ds/AvatarFace'
import type { FeedItem } from '@/lib/community/server'
import { authorLineOf, goingLabel, panelNewsHref, personTagOf, votesLabel } from './community-core'

export interface CardActions {
  onLike: (item: FeedItem) => void
  onSave: (item: FeedItem) => void
  onShare: (item: FeedItem) => void
  onComment: (item: FeedItem) => void
  onFollow: (item: FeedItem) => void
  onGoing: (item: FeedItem) => void
  onVote: (item: FeedItem, option: number) => void
}

export function FeedCard({ item, actions, busy, myMemberId }: { item: FeedItem; actions: CardActions; busy: boolean; myMemberId: number | null }) {
  const tag = personTagOf(item)
  const line = authorLineOf(item)
  // No "Seguir" on your own posts (the prototype hides it for `eu`).
  const canFollow = item.author.memberId != null && item.author.memberId !== myMemberId
  const poll = item.poll
  const voted = poll ? poll.myVote != null : false
  const isEvent = item.kind === 'EVENT' || item.kind === 'AGENDA'
  const likeCls = `ha-cm-act${item.liked ? ' ha-cm-act--liked' : ''}`
  return (
    <article className="ha-cm-post" aria-label={item.title ?? item.body.slice(0, 60) ?? 'Post'}>
      <div className="ha-cm-post__by">
        {item.author.profileHref
          ? <Link href={item.author.profileHref} className="ha-avatar ha-cm-post__avatar ha-cm-post__avatar--link" aria-label={`Perfil de ${item.author.name}`}><AvatarFace initials={item.author.initials} url={item.author.avatarUrl} /></Link>
          : <span className="ha-avatar ha-cm-post__avatar" aria-hidden="true"><AvatarFace initials={item.author.initials} url={item.author.avatarUrl} /></span>}
        <div className="ha-cm-post__who">
          <span className="ha-cm-post__name">{item.author.profileHref ? <Link href={item.author.profileHref} className="ha-cm-post__namelink">{item.author.name}</Link> : <span>{item.author.name}</span>}<span className={`ha-cm-tag${tag.official ? ' ha-cm-tag--official' : ''}`}>{tag.label}</span></span>
          {line ? <span className="ha-cm-post__sub">{line}</span> : null}
        </div>
        {canFollow ? (
          <button type="button" className={`ha-cm-follow${item.author.following ? ' ha-cm-follow--on' : ''}`} disabled={busy} onClick={() => actions.onFollow(item)} aria-pressed={item.author.following}>
            {item.author.following ? 'Seguindo' : 'Seguir'}
          </button>
        ) : null}
      </div>

      {item.body && item.kind !== 'NEWS' ? <p className="ha-cm-post__text">{item.body}</p> : null}

      {item.kind === 'PHOTO' || (item.kind === 'TEXT' && item.artwork) ? (
        <div className="ha-cm-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store or the post's own URL */}
          {item.imageUrl ? <div className="ha-cm-photo__wall"><img src={item.imageUrl} alt={item.artwork ? `Obra ${item.artwork.title}` : ''} /></div> : null}
          {item.artwork ? (
            <Link href={`/e/artwork/${item.artwork.publicId}`} className="ha-cm-artwork">
              <Icon name="sell" size={20} />
              <span className="ha-cm-artwork__t"><span className="ha-cm-artwork__title">{item.artwork.title}</span><span className="ha-cm-artwork__sub">{item.artwork.artist} · {item.artwork.price ?? 'certificada'}</span></span>
              <span className="ha-cm-artwork__cta">Ver obra</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {item.kind === 'NEWS' ? (
        <Link href={panelNewsHref(item.href) ?? '/community'} className="ha-cm-news">
          {/* eslint-disable-next-line @next/next/no-img-element -- news image */}
          {item.imageUrl ? <span className="ha-cm-news__img"><img src={item.imageUrl} alt="" /></span> : null}
          {item.format ? <span className="ha-cm-news__format">{item.format}</span> : null}
          <span className="ha-cm-news__title">{item.title}</span>
          {item.summary ? <span className="ha-cm-news__summary">{item.summary}</span> : null}
          <span className="ha-cm-news__foot"><span className="ha-cm-news__source">{item.author.name}</span><span className="ha-cm-news__read">Ler<Icon name="arrow_forward" size={18} /></span></span>
        </Link>
      ) : null}

      {poll ? (
        <div className="ha-cm-poll" role="group" aria-label="Enquete">
          {poll.options.map((o, i) => (
            <button key={i} type="button" className={`ha-cm-poll__opt${poll.myVote === i ? ' ha-cm-poll__opt--mine' : ''}`} disabled={busy} onClick={() => actions.onVote(item, i)} aria-pressed={poll.myVote === i}>
              <span className="ha-cm-poll__fill" style={{ width: voted ? `${o.pct}%` : '0%' }} aria-hidden="true" />
              <span>{o.label}</span><span className="ha-cm-poll__pct">{voted ? `${o.pct}%` : ''}</span>
            </button>
          ))}
          <span className="ha-cm-poll__votes">{votesLabel(poll.total, voted)}</span>
        </div>
      ) : null}

      {isEvent ? (
        <div className="ha-cm-event">
          <span className="ha-cm-event__date" aria-label={`${item.day} de ${item.month}`}><span className="ha-cm-event__day">{item.day}</span><span className="ha-cm-event__month">{item.month}</span></span>
          <span className="ha-cm-event__body">
            <span className="ha-cm-event__title">{item.kind === 'AGENDA' && item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</span>
            <span className="ha-cm-event__venue">{[item.startsAt, item.venue].filter(Boolean).join(' · ')}</span>
            <span className="ha-cm-event__row">
              <span className="ha-cm-event__going">{goingLabel(item.going ?? 0)}</span>
              <button type="button" className={`ha-cm-going${item.iAmGoing ? ' ha-cm-going--on' : ''}`} disabled={busy} onClick={() => actions.onGoing(item)} aria-pressed={item.iAmGoing}>{item.iAmGoing ? 'Eu vou ✓' : 'Eu vou'}</button>
            </span>
          </span>
        </div>
      ) : null}

      <div className="ha-cm-actions">
        <button type="button" className={likeCls} aria-label={item.liked ? 'Descurtir' : 'Curtir'} aria-pressed={item.liked} disabled={busy} onClick={() => actions.onLike(item)}><Icon name="favorite" filled={item.liked} />{item.likes}</button>
        {item.canComment ? (
          <button type="button" className="ha-cm-act" aria-label="Comentar" onClick={() => actions.onComment(item)}><Icon name="chat_bubble" />{item.comments}</button>
        ) : (
          <span className="ha-cm-act ha-cm-act--mute" aria-hidden="true"><Icon name="chat_bubble" /></span>
        )}
        <button type="button" className="ha-cm-act" aria-label="Compartilhar" onClick={() => actions.onShare(item)}><Icon name="send" /></button>
        <span className="ha-cm-actions__spacer" />
        <button type="button" className="ha-cm-act" aria-label={item.saved ? 'Remover dos salvos' : 'Salvar'} aria-pressed={item.saved} disabled={busy} onClick={() => actions.onSave(item)}><Icon name="bookmark" filled={item.saved} /></button>
      </div>
    </article>
  )
}
