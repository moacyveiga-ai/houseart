// Galeria (handoff "HouseArt Galeria"): the public page of a gallery. Sections
// without data disappear. The works filter by artist is server-side (?artista=);
// rooms and media tabs are small client islands. The map is an OpenStreetMap
// embed (the prototype uses Leaflet; no dependency here).
import Link from 'next/link'
import { PublicReactButton } from './PublicReactButton'
import { TalkToSellerButton } from './TalkToSellerButton'
import { Icon } from '@/components/ds/Icon'
import type { PublicGalleryPage, PublicWork } from '@/lib/public-content/server'
import { galleryInitial, initialsOf, mapLinks, osmEmbedUrl, workPriceLabel } from '@/lib/public-content/profile-core'
import { GalleryMedia } from './GalleryMedia'
import { GalleryRooms } from './GalleryRooms'
import { Publications } from './Publications'
import './gallery.css'

function WorkCard({ w, gallery }: { w: PublicWork; gallery: string }) {
  return (
    <Link href={`/e/artwork/${w.publicId}`} className="hp-gallery-work">
      <span className="hp-gallery-work__wall">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {w.cover ? <img src={w.cover} alt={w.title} loading="lazy" /> : null}
        <span className="hp-gallery-work__cert"><Icon name="verified" size={14} />Certificada</span>
      </span>
      <span className="hp-gallery-work__body">
        <span className="hp-gallery-work__artist">{w.artist}</span>
        <span className="hp-gallery-work__title">{w.title}{w.year ? `, ${w.year}` : ''}</span>
        <span className="hp-gallery-work__meta">{[w.technique, w.dimensions !== '—' ? w.dimensions : null].filter(Boolean).join(' · ')}</span>
        <span className="hp-gallery-work__seller"><Icon name="storefront" size={14} />{gallery} · <b>Galeria</b></span>
        <span className="hp-gallery-work__price">{workPriceLabel(w)}</span>
      </span>
    </Link>
  )
}

export function Gallery({ g, artistFilter, viewer = { signedIn: false, following: false } }: { g: PublicGalleryPage; artistFilter: string | null; viewer?: { signedIn: boolean; following: boolean } }) {
  const filterOk = artistFilter && g.artistList.some((a) => a.slug === artistFilter) ? artistFilter : null
  const works = filterOk ? g.artworks.filter((w) => w.artistSlug === filterOk) : g.artworks
  const hasAbout = g.about.length > 0 || g.milestones.length > 0
  const hasMedia = g.photos.length > 0 || g.videos.length > 0
  const hasPlace = !!(g.street || g.district || g.city || g.hours || g.email || g.phone || g.websiteUrl || g.instagram)
  const hasMap = g.lat !== null && g.lng !== null
  const anchors = [
    hasAbout ? { href: '#sobre', label: 'História' } : null,
    g.artworks.length ? { href: '#obras', label: 'Obras à venda' } : null,
    g.artistList.length ? { href: '#artistas', label: 'Artistas' } : null,
    g.rooms.length ? { href: '#tour', label: 'Tour virtual' } : null,
    hasMedia ? { href: '#midia', label: 'Fotos e vídeos' } : null,
    g.publications.length ? { href: '#ebooks', label: 'E-books' } : null,
    g.team.length ? { href: '#equipe', label: 'Responsáveis' } : null,
    hasPlace ? { href: '#local', label: 'Localização' } : null,
  ].filter((x): x is { href: string; label: string } => !!x)
  const links = hasMap ? mapLinks(g.lat!, g.lng!) : null
  const base = `/e/gallery/${g.slug}`

  return (
    <>
      <section className="hp-gallery-cover">
        <div className="hp-gallery-cover__img">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
          {g.coverUrl ? <img src={g.coverUrl} alt="" /> : null}
        </div>
        <div className="hp-container">
          <div className="hp-gallery-card">
            <div className="hp-gallery-card__id">
              <span className="hp-gallery-mark" aria-hidden="true">{galleryInitial(g.name)}</span>
              <div className="hp-gallery-card__names">
                <span className="hp-gallery-verified"><Icon name="verified" size={16} filled />Galeria verificada HouseArt</span>
                <h1 className="hp-gallery-name">{g.name}</h1>
                <span className="hp-gallery-where">{[g.city, g.foundedYear ? `fundada em ${g.foundedYear}` : null].filter(Boolean).join(' · ')}</span>
                {g.tags.length ? <div className="hp-gallery-tags">{g.tags.map((t) => <span key={t} className="hp-gallery-tag">{t}</span>)}</div> : null}
              </div>
            </div>
            <div className="hp-gallery-card__side">
              <div className="hp-gallery-counts">
                <div className="hp-gallery-count"><span className="hp-gallery-count__n">{g.works}</span><span className="hp-gallery-count__l">obras à venda</span></div>
                <div className="hp-gallery-count"><span className="hp-gallery-count__n">{g.artists}</span><span className="hp-gallery-count__l">artistas</span></div>
              </div>
              <div className="hp-gallery-actions">
                {g.followMemberId ? (
                  <PublicReactButton target="MEMBER" targetId={g.followMemberId} kind="FOLLOW" on={viewer.following} signedIn={viewer.signedIn} className="hp-gallery-btn hp-gallery-btn--ink"
                    onChildren={<><Icon name="check" size={18} />Seguindo</>}><Icon name="add" size={18} />Seguir galeria</PublicReactButton>
                ) : null}
                {hasPlace ? <a href="#local" className="hp-gallery-btn"><Icon name="event" size={18} />Agendar visita</a> : null}
                {g.followMemberId ? <TalkToSellerButton gallery={g.slug} signedIn={viewer.signedIn} className="hp-gallery-btn" label={<><Icon name="chat" size={18} />Falar com a galeria</>} />
                  : g.team.length || g.email || g.phone ? <a href={g.team.length ? '#equipe' : '#local'} className="hp-gallery-btn"><Icon name="chat" size={18} />Falar com a galeria</a> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {anchors.length ? (
        <nav className="hp-gallery-anchors" aria-label="Seções da galeria">
          <div className="hp-gallery-anchors__inner">{anchors.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</div>
        </nav>
      ) : null}

      {hasAbout ? (
        <section id="sobre" className="hp-gallery-section hp-gallery-about">
          <div className="hp-gallery-about__text">
            <h2 className="hp-section-title">História da galeria</h2>
            {g.about.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {g.milestones.length ? (
            <div className="hp-gallery-marks">
              <span className="hp-gallery-label">Marcos</span>
              <ol>
                {g.milestones.map((m, i) => (
                  <li key={`${m.year}-${i}`}>
                    <span className="hp-gallery-marks__year">{m.year}</span>
                    <span className="hp-gallery-marks__rail"><span className="hp-gallery-marks__line" /><span className="hp-gallery-marks__dot" /></span>
                    <span className="hp-gallery-marks__text">{m.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {g.artworks.length ? (
        <section id="obras" className="hp-gallery-works">
          <div className="hp-gallery-works__inner">
            <div className="hp-gallery-head">
              <div className="hp-gallery-head__titles">
                <h2 className="hp-section-title">Obras à venda</h2>
                <span className="hp-gallery-sub">Vendidas pela própria galeria, todas certificadas.</span>
              </div>
              {g.artistList.length > 1 ? (
                <div className="hp-gallery-chips" role="group" aria-label="Filtrar por artista">
                  <Link href={`${base}#obras`} className={`hp-gallery-chip${filterOk ? '' : ' hp-gallery-chip--on'}`} aria-current={filterOk ? undefined : 'true'} scroll={false}>Todos</Link>
                  {g.artistList.map((a) => <Link key={a.slug} href={`${base}?artista=${a.slug}#obras`} className={`hp-gallery-chip${filterOk === a.slug ? ' hp-gallery-chip--on' : ''}`} aria-current={filterOk === a.slug ? 'true' : undefined} scroll={false}>{a.name}</Link>)}
                </div>
              ) : null}
            </div>
            <div className="hp-gallery-grid">{works.map((w) => <WorkCard key={w.publicId} w={w} gallery={g.name} />)}</div>
          </div>
        </section>
      ) : null}

      {g.artistList.length ? (
        <section id="artistas" className={`hp-gallery-section hp-gallery-section--col-lg${g.rooms.length || hasMedia ? ' hp-gallery-section--pb10' : ''}`}>
          <h2 className="hp-section-title">Artistas representados</h2>
          <div className="hp-gallery-artists">
            {g.artistList.map((a) => (
              <Link key={a.slug} href={`/e/artist/${a.slug}`} className="hp-gallery-artist">
                <span className="hp-gallery-artist__photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {a.photoUrl ? <img src={a.photoUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{initialsOf(a.name)}</span>}
                </span>
                <span className="hp-gallery-artist__name">{a.name}</span>
                {a.meta ? <span className="hp-gallery-artist__meta">{a.meta}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {g.rooms.length ? (
        <section id="tour" className="hp-gallery-section hp-gallery-section--col hp-gallery-section--pt10 hp-gallery-section--pb10">
          <GalleryRooms rooms={g.rooms} />
        </section>
      ) : null}

      {hasMedia ? (
        <section id="midia" className="hp-gallery-section hp-gallery-section--col hp-gallery-section--pt10">
          <GalleryMedia photos={g.photos} videos={g.videos} />
        </section>
      ) : null}

      <Publications id="ebooks" title="E-books e catálogos" subtitle="Publicações das exposições e textos curatoriais da galeria." items={g.publications} />

      {g.team.length ? (
        <section id="equipe" className={`hp-gallery-section hp-gallery-section--col-lg${hasPlace ? ' hp-gallery-section--pb10' : ''}`}>
          <h2 className="hp-section-title">Responsáveis</h2>
          <div className="hp-gallery-team">
            {g.team.map((p, i) => (
              <div key={`${p.name}-${i}`} className="hp-gallery-person">
                <div className="hp-gallery-person__photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{initialsOf(p.name)}</span>}
                </div>
                <div className="hp-gallery-person__body">
                  <span className="hp-gallery-person__name">{p.name}</span>
                  {p.role ? <span className="hp-gallery-person__role">{p.role}</span> : null}
                  {p.bio ? <p className="hp-gallery-person__bio">{p.bio}</p> : null}
                  {p.email || p.phone ? (
                    <span className="hp-gallery-person__contacts">
                      {p.email ? <a href={`mailto:${p.email}`}><Icon name="mail" size={16} />{p.email}</a> : null}
                      {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}><Icon name="call" size={16} />{p.phone}</a> : null}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasPlace ? (
        <section id="local" className={`hp-gallery-section hp-gallery-section--col-lg${g.team.length ? ' hp-gallery-section--pt10' : ''}`}>
          <h2 className="hp-section-title">Localização</h2>
          <div className="hp-gallery-place">
            {hasMap ? <div className="hp-gallery-map"><iframe src={osmEmbedUrl(g.lat!, g.lng!)} title={`Mapa: ${g.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div> : null}
            <div className="hp-gallery-place__info">
              {g.street || g.district || g.city ? (
                <div className="hp-gallery-place__block">
                  <span className="hp-gallery-label">Endereço</span>
                  {g.street ? <span className="hp-gallery-place__street">{g.street}</span> : null}
                  <span className="hp-gallery-place__line">{[g.district, g.city].filter(Boolean).join(' · ')}</span>
                </div>
              ) : null}
              {g.hours ? (
                <div className="hp-gallery-place__block">
                  <span className="hp-gallery-label">Horário</span>
                  <span className="hp-gallery-place__line">{g.hours}</span>
                </div>
              ) : null}
              {g.email || g.phone || g.websiteUrl || g.instagram ? (
                <div className="hp-gallery-place__block">
                  <span className="hp-gallery-label">Contato</span>
                  {g.email ? <span className="hp-gallery-place__contact"><Icon name="mail" size={18} /><a href={`mailto:${g.email}`}>{g.email}</a></span> : null}
                  {g.phone ? <span className="hp-gallery-place__contact"><Icon name="call" size={18} />{g.phone}</span> : null}
                  {g.websiteUrl ? <span className="hp-gallery-place__contact"><Icon name="language" size={18} /><a href={g.websiteUrl} target="_blank" rel="noopener noreferrer">{g.websiteUrl.replace(/^https?:\/\//, '')}</a></span> : null}
                  {g.instagram ? <span className="hp-gallery-place__contact"><Icon name="photo_camera" size={18} />{g.instagram}</span> : null}
                </div>
              ) : null}
              {links ? (
                <div className="hp-gallery-place__btns">
                  <a href={links.directions} target="_blank" rel="noopener noreferrer" className="hp-gallery-map-btn hp-gallery-map-btn--ink"><Icon name="directions" size={18} />Como chegar</a>
                  <a href={links.waze} target="_blank" rel="noopener noreferrer" className="hp-gallery-map-btn">Abrir no Waze</a>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <p className="hp-gallery-foot"><Link href="/e/galleries">Ver todas as galerias</Link></p>
    </>
  )
}
