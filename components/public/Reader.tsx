'use client'
// O leitor do handoff ("HouseArt App Colecionador" › Ler notícia e Guia de
// educação): barra com o kicker, tamanho do texto, salvar e compartilhar sobre a
// barra de progresso da leitura; título Fraunces, linha fina, autoria, imagem na
// parede, blocos (parágrafo, subtítulo, citação, item numerado), fonte, ações
// (curtir · comentar · "Isso foi útil?"), próximo da trilha e "Leia também".
// Curtir, salvar e comentar só com sessão — sem ela, a porta é o /login.
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { CommentsSheet } from '@/components/community/CommentsSheet'
import type { FeedItem } from '@/lib/community/server'
import { numberedBlocks, readProgress, trailSegments, type ReadBlock } from './reading-core'

export interface ReaderSocial { id: number; likes: number; liked: boolean; saved: boolean; comments: number; feedItem: FeedItem }
export interface ReaderProps {
  kicker: string
  title: string
  lead: string | null
  author: string
  meta: string
  imageUrl: string | null
  blocks: ReadBlock[]
  source: { name: string; url: string | null } | null
  trail: { name: string; step: number; total: number } | null
  next: { title: string; href: string | null } | null
  related: { kicker: string; title: string; href: string }[]
  backHref: string
  sharePath: string
  /** null = the guide (no reactions, no comments) */
  social: ReaderSocial | null
  viewer: { signedIn: boolean; initials: string }
}

export function Reader(p: ReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(0)
  const [large, setLarge] = useState(false)
  const [toast, setToast] = useState('')
  const [social, setSocial] = useState(p.social)
  const [commenting, setCommenting] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const el = bodyRef.current; if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      setPct(Math.round(readProgress(top, el.offsetHeight, window.scrollY, window.innerHeight) * 100))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const toLogin = useCallback(() => { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}` }, [])

  async function react(kind: 'LIKE' | 'SAVE') {
    if (!social) return
    if (!p.viewer.signedIn) { toLogin(); return }
    if (busy) return
    setBusy(true)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'NEWS', targetId: social.id, kind }) })
    const data = (await res.json().catch(() => ({}))) as { on?: boolean; count?: number; error?: string }
    setBusy(false)
    if (!res.ok || typeof data.on !== 'boolean') { setToast(data.error ?? 'Não foi possível registrar.'); return }
    if (kind === 'LIKE') setSocial({ ...social, liked: data.on, likes: data.count ?? social.likes })
    else { setSocial({ ...social, saved: data.on }); setToast(data.on ? 'Salvo para ler depois' : 'Removido dos salvos') }
  }

  async function share() {
    const url = `${window.location.origin}${p.sharePath}`
    const text = `Vale a leitura: ${p.title}`
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ title: p.title, text, url }); return }
      await navigator.clipboard.writeText(url); setToast('Link copiado')
    } catch { /* cancelled by the person */ }
  }

  return (
    <article className={`hp-read${large ? ' hp-read--large' : ''}`} aria-labelledby="read-title">
      <div className="hp-read__bar">
        <div className="hp-read__row">
          <Link href={p.backHref} className="hp-read__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link>
          <span className="hp-read__kicker">{p.kicker}</span>
          <button type="button" className="hp-read__ic" aria-label="Tamanho do texto" aria-pressed={large} onClick={() => setLarge((v) => !v)}><Icon name="text_fields" size={24} /></button>
          {social ? <button type="button" className={`hp-read__ic${social.saved ? ' hp-read__ic--on' : ''}`} aria-label={social.saved ? 'Remover dos salvos' : 'Salvar'} aria-pressed={social.saved} disabled={busy} onClick={() => react('SAVE')}><Icon name="bookmark" size={24} filled={social.saved} /></button> : null}
          <button type="button" className="hp-read__ic" aria-label="Compartilhar" onClick={share}><Icon name="ios_share" size={24} /></button>
        </div>
        <span className="hp-read__track" role="progressbar" aria-label="Progresso da leitura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span className="hp-read__pct" style={{ width: `${pct}%` }} /></span>
      </div>

      {p.trail ? (
        <div className="hp-read__trail">
          <Icon name="school" size={22} />
          <span className="hp-read__trail-t"><span className="hp-read__trail-n">{p.trail.name}</span><span className="hp-read__trail-s">Guia {p.trail.step} de {p.trail.total}</span></span>
          <span className="hp-read__segs" aria-hidden="true">{trailSegments(p.trail.step, p.trail.total).map((on, i) => <span key={i} className={`hp-read__seg${on ? ' hp-read__seg--on' : ''}`} />)}</span>
        </div>
      ) : null}

      <h1 id="read-title" className="hp-read__title">{p.title}</h1>
      {p.lead ? <p className="hp-read__lead">{p.lead}</p> : null}
      <div className="hp-read__by">
        <span className="hp-read__by-av" aria-hidden="true">HA</span>
        <span className="hp-read__by-t"><span className="hp-read__by-n">{p.author}</span><span className="hp-read__by-m">{p.meta}</span></span>
      </div>

      <div ref={bodyRef} className="hp-read__body">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem da notícia */}
        {p.imageUrl ? <div className="hp-read__img"><img src={p.imageUrl} alt="" /></div> : null}
        {numberedBlocks(p.blocks).map((b, i) => {
          if (b.kind === 'h') return <h2 key={i} className="hp-read__h">{b.text}</h2>
          if (b.kind === 'q') return <blockquote key={i} className="hp-read__q">{b.text}</blockquote>
          if (b.kind === 'li') { return <div key={i} className="hp-read__li"><span className="hp-read__li-n" aria-hidden="true">{b.n}</span><span className="hp-read__li-t"><span className="hp-read__li-k">{b.text}</span><span className="hp-read__li-s">{b.sub}</span></span></div> }
          return <p key={i} className="hp-read__p">{b.text}</p>
        })}
        {p.source ? <p className="hp-read__source">Fonte: {p.source.url ? <a href={p.source.url} target="_blank" rel="noopener noreferrer">{p.source.name}</a> : p.source.name}</p> : null}
      </div>

      <div className="hp-read__acts">
        {social ? (
          <>
            <button type="button" className={`hp-read__act${social.liked ? ' hp-read__act--liked' : ''}`} aria-label={social.liked ? 'Descurtir' : 'Curtir'} aria-pressed={social.liked} disabled={busy} onClick={() => react('LIKE')}><Icon name="favorite" filled={social.liked} />{social.likes}</button>
            <button type="button" className="hp-read__act" aria-label="Comentar" onClick={() => (p.viewer.signedIn ? setCommenting(true) : toLogin())}><Icon name="chat_bubble" />{social.comments}</button>
          </>
        ) : null}
        <span className="hp-read__spacer" />
        <span className="hp-read__useful">Isso foi útil?</span>
        <button type="button" className="hp-read__act" aria-label="Útil" onClick={() => setToast('Obrigado! Isso ajuda a escolher os próximos temas')}><Icon name="thumb_up" size={20} /></button>
      </div>
      {social && !p.viewer.signedIn ? <span className="hp-read__signin"><Link href="/login">Entre</Link> para curtir, salvar e comentar.</span> : null}

      {p.next ? (
        p.next.href ? (
          <Link href={p.next.href} className="hp-read__next"><span className="hp-read__next-t"><span className="hp-read__next-k">Próximo da trilha</span><span className="hp-read__next-n">{p.next.title}</span></span><Icon name="arrow_forward" size={22} /></Link>
        ) : (
          <button type="button" className="hp-read__next" onClick={() => setToast('Próximo guia da trilha chega na sua comunidade em breve')}><span className="hp-read__next-t"><span className="hp-read__next-k">Próximo da trilha</span><span className="hp-read__next-n">{p.next.title}</span></span><Icon name="arrow_forward" size={22} /></button>
        )
      ) : null}

      {p.related.length ? (
        <>
          <span className="hp-read__more-k">Leia também</span>
          {p.related.map((r) => <Link key={r.href} href={r.href} className="hp-read__more"><span className="hp-read__more-cat">{r.kicker}</span><span className="hp-read__more-t">{r.title}</span></Link>)}
        </>
      ) : null}

      {commenting && social ? (
        <CommentsSheet item={social.feedItem} me={{ initials: p.viewer.initials }} onClose={() => setCommenting(false)} onCount={(_k, delta) => setSocial((s) => (s ? { ...s, comments: s.comments + delta } : s))} onToast={setToast} />
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </article>
  )
}
