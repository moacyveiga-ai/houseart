// Artista (handoff "HouseArt Artista"): the public profile. Every section without
// data disappears; nothing is invented. The works filter is server-side (?obras=),
// the exhibition tabs are a small client island.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { StatusBadge } from '@/components/ds/StatusBadge'
import type { PublicArtistPage, PublicWork } from '@/lib/public-content/server'
import { artistStatus, initialsOf, passesWorkFilter, royaltyText, sellerLine, WORK_FILTERS, workPriceLabel, type WorkFilter } from '@/lib/public-content/profile-core'
import { ExhibitionTabs } from './ExhibitionTabs'
import { Publications } from './Publications'
import './artist.css'

function WorkCard({ w }: { w: PublicWork }) {
  const seller = sellerLine(w.seller)
  const sold = w.status === 'SOLD'
  return (
    <Link href={`/e/artwork/${w.publicId}`} className={`hp-artist-card${sold ? ' hp-artist-card--sold' : ''}`}>
      <span className="hp-artist-card__wall">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {w.cover ? <img src={w.cover} alt={w.title} loading="lazy" /> : null}
        <span className="hp-artist-card__cert"><Icon name="verified" size={14} />Certificada</span>
        {sold ? <span className="hp-artist-card__sold"><StatusBadge status="sold" /></span> : null}
      </span>
      <span className="hp-artist-card__body">
        <span className="hp-artist-card__title">{w.title}{w.year ? `, ${w.year}` : ''}</span>
        <span className="hp-artist-card__meta">{[w.technique, w.dimensions !== '—' ? w.dimensions : null].filter(Boolean).join(' · ')}</span>
        <span className="hp-artist-card__seller"><Icon name={seller.icon} size={14} />{seller.name} · <b>{seller.kind}</b></span>
        <span className="hp-artist-card__price">{workPriceLabel(w)}</span>
      </span>
    </Link>
  )
}

export function Artist({ a, filter }: { a: PublicArtistPage; filter: WorkFilter }) {
  const e = a.entries
  const works = a.works.filter((w) => passesWorkFilter(w.status, filter))
  const counts = Object.fromEntries(WORK_FILTERS.map((f) => [f.key, a.works.filter((w) => passesWorkFilter(w.status, f.key)).length])) as Record<WorkFilter, number>
  const hasBio = a.bio.length > 0 || e.TRAJECTORY.length > 0
  const hasExpo = e.SOLO.length > 0 || e.GROUP.length > 0
  const more: { icon: string; title: string; items: string[] }[] = []
  if (e.EDUCATION.length) more.push({ icon: 'school', title: 'Formação', items: e.EDUCATION.map((x) => [x.title, x.venue, x.year].filter(Boolean).join(', ')) })
  if (e.COLLECTION.length) more.push({ icon: 'account_balance', title: 'Acervos públicos', items: e.COLLECTION.map((x) => [x.title, x.city].filter(Boolean).join(', ')) })
  if (a.alive && a.representation) more.push({ icon: 'storefront', title: 'Representação', items: [a.representation] })
  if (!a.alive && a.estateName) more.push({ icon: 'family_history', title: 'Espólio e herdeiros', items: [a.estateName] })
  if (a.royaltyBps) more.push({ icon: 'gavel', title: 'Direito de sequência', items: [royaltyText(a.royaltyBps, a.alive)] })
  const anchors = [
    hasBio ? { href: '#biografia', label: 'Biografia' } : null,
    a.works.length ? { href: '#obras', label: 'Obras na plataforma' } : null,
    hasExpo ? { href: '#exposicoes', label: 'Exposições' } : null,
    e.AWARD.length ? { href: '#premios', label: 'Prêmios' } : null,
    a.publications.length ? { href: '#publicacoes', label: 'E-books e publicações' } : null,
    more.length ? { href: '#mais', label: 'Mais informações' } : null,
  ].filter((x): x is { href: string; label: string } => !!x)

  return (
    <>
      <div className="hp-artist-crumb"><Link href="/e/artists">Artistas</Link><span>/</span><span className="hp-artist-crumb__here">{a.name}</span></div>

      <section className="hp-artist-hero">
        <div className={`hp-artist-photo${a.alive ? '' : ' hp-artist-photo--memoriam'}`}>
          <div className="hp-artist-photo__frame">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            {a.photoUrl ? <img src={a.photoUrl} alt={`Foto de ${a.name}`} /> : <span className="hp-artist-photo__initials" aria-label={`Iniciais de ${a.name}`}>{initialsOf(a.name)}</span>}
          </div>
          {a.photoCredit && a.photoUrl ? <span className="hp-artist-photo__credit">{a.photoCredit}</span> : null}
        </div>
        <div className="hp-artist-head">
          <div className="hp-artist-kind">
            <span className="hp-artist-kind__label">Artista</span>
            <span className={`hp-artist-status${a.alive ? ' hp-artist-status--alive' : ''}`}>{artistStatus(a.alive, a.span)}</span>
            <span className="hp-artist-verified"><Icon name="verified" size={16} />Identidade verificada</span>
          </div>
          <div className="hp-artist-names">
            <h1 className="hp-artist-name">{a.name}</h1>
            {a.fullName && a.fullName !== a.name ? <span className="hp-artist-fullname">{a.fullName}</span> : null}
          </div>
          {a.facts.length ? (
            <dl className="hp-artist-facts">
              {a.facts.map((f) => <div key={f.k} className="hp-artist-fact"><dt>{f.k}</dt><dd>{f.v}</dd></div>)}
            </dl>
          ) : null}
          {a.languages.length ? <div className="hp-artist-langs">{a.languages.map((l) => <span key={l} className="hp-artist-lang">{l}</span>)}</div> : null}
          {a.quote ? <blockquote className="hp-artist-quote">“{a.quote}”</blockquote> : null}
          <div className="hp-artist-actions">
            <button type="button" className="hp-artist-follow" aria-disabled="true" title="Em breve"><Icon name="notifications" size={20} />Seguir e receber novas obras</button>
            {a.works.length ? <a href="#obras" className="hp-artist-works-link">Ver {a.works.length} {a.works.length === 1 ? 'obra' : 'obras'}</a> : null}
            <button type="button" className="hp-artist-share" aria-label="Compartilhar" aria-disabled="true" title="Em breve"><Icon name="ios_share" size={20} /></button>
          </div>
        </div>
      </section>

      {anchors.length ? (
        <nav className="hp-artist-anchors" aria-label="Seções do perfil">
          <div className="hp-artist-anchors__inner">{anchors.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</div>
        </nav>
      ) : null}

      {hasBio ? (
        <section id="biografia" className="hp-artist-section hp-artist-bio">
          <div className="hp-artist-bio__text">
            <h2 className="hp-section-title">Biografia</h2>
            {a.bio.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {e.TRAJECTORY.length ? (
            <div className="hp-artist-traj">
              <span className="hp-artist-label">Trajetória</span>
              <ol>
                {e.TRAJECTORY.map((t, i) => (
                  <li key={`${t.year}-${i}`}>
                    <span className="hp-artist-traj__year">{t.year}</span>
                    <span className="hp-artist-traj__rail"><span className="hp-artist-traj__line" /><span className="hp-artist-traj__dot" /></span>
                    <span className="hp-artist-traj__text">{t.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {a.works.length ? (
        <section id="obras" className="hp-artist-works">
          <div className="hp-artist-works__inner">
            <div className="hp-artist-section-head">
              <div className="hp-artist-section-head__titles">
                <h2 className="hp-section-title">Obras na plataforma</h2>
                <span className="hp-artist-sub">Todas certificadas com etiqueta HouseArt e escritura registrada.</span>
              </div>
              <div className="hp-artist-filters" role="group" aria-label="Filtrar obras">
                {WORK_FILTERS.map((f) => (
                  <Link key={f.key} href={f.key === 'todas' ? `/e/artist/${a.slug}#obras` : `/e/artist/${a.slug}?obras=${f.key}#obras`} className={`hp-artist-filter${f.key === filter ? ' hp-artist-filter--on' : ''}`} aria-current={f.key === filter ? 'true' : undefined} scroll={false}>
                    {f.label} <span className="hp-artist-filter__n">{counts[f.key]}</span>
                  </Link>
                ))}
              </div>
            </div>
            {works.length ? <div className="hp-artist-grid">{works.map((w) => <WorkCard key={w.publicId} w={w} />)}</div> : <div className="hp-empty">Nenhuma obra neste filtro.</div>}
          </div>
        </section>
      ) : null}

      {hasExpo ? (
        <section id="exposicoes" className={`hp-artist-section hp-artist-section--col${e.AWARD.length ? ' hp-artist-section--tight-bottom' : ''}`}>
          <ExhibitionTabs solo={e.SOLO} group={e.GROUP} />
        </section>
      ) : null}

      {e.AWARD.length ? (
        <section id="premios" className={`hp-artist-section hp-artist-section--col${hasExpo ? ' hp-artist-section--tight-top' : ''}`}>
          <h2 className="hp-section-title">Prêmios e distinções</h2>
          <div className="hp-artist-awards">
            {e.AWARD.map((p, i) => (
              <div key={`${p.year}-${i}`} className="hp-artist-award">
                <Icon name="workspace_premium" size={24} />
                <div className="hp-artist-award__body">
                  {p.year ? <span className="hp-artist-award__year">{p.year}</span> : null}
                  <span className="hp-artist-award__name">{p.title}</span>
                  {p.venue ? <span className="hp-artist-award__org">{p.venue}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Publications id="publicacoes" title="E-books e publicações" subtitle="Catálogos, ensaios e livros sobre a obra, para ler online ou baixar." items={a.publications} />

      {more.length ? (
        <section id="mais" className="hp-artist-section hp-artist-section--col-lg">
          <h2 className="hp-section-title">Mais informações</h2>
          <div className="hp-artist-more">
            {more.map((m) => (
              <div key={m.title} className="hp-artist-more__block">
                <div className="hp-artist-more__head"><Icon name={m.icon} size={20} />{m.title}</div>
                {m.items.map((t, i) => <span key={i} className="hp-artist-more__item">{t}</span>)}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="hp-artist-note">Informações biográficas fornecidas pelo artista ou espólio e revisadas pela curadoria HouseArt.</p>
    </>
  )
}
