// Galerias (handoff "HouseArt Galerias"): the list of verified galleries with works
// for sale. Search and UF go by a GET form; specialty chips are links; everything
// is resolved on the server.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import type { PublicGalleryCard } from '@/lib/public-content/server'
import { UfSelect } from './UfSelect'
import { galleriesHref, galleriesSummary, galleryInitial } from '@/lib/public-content/profile-core'
import './galleries.css'

export interface GalleriesFilters { q: string | null; uf: string | null; tag: string | null }

export function Galleries({ items, tags, ufs, f }: { items: PublicGalleryCard[]; tags: string[]; ufs: string[]; f: GalleriesFilters }) {
  const works = items.reduce((n, g) => n + g.works, 0)
  return (
    <>
      <section className="hp-galleries">
        <form className="hp-galleries-top" method="get" action="/e/galleries">
          <div className="hp-galleries-intro">
            <span className="hp-galleries-eyebrow">Galerias parceiras</span>
            <h1 className="hp-galleries-title">Galerias com obras à venda</h1>
            <p className="hp-galleries-lead">Cada galeria é verificada pela HouseArt e certifica as obras em nome dos artistas que representa.</p>
          </div>
          <label className="hp-galleries-search">
            <Icon name="search" size={20} />
            <input type="search" name="q" defaultValue={f.q ?? ''} placeholder="Buscar galeria ou cidade" aria-label="Buscar galeria" />
            {f.tag ? <input type="hidden" name="tag" value={f.tag} /> : null}
            {f.uf ? <input type="hidden" name="uf" value={f.uf} /> : null}
          </label>
        </form>

        <div className="hp-galleries-bar">
          <div className="hp-galleries-chips" role="group" aria-label="Especialidade">
            <Link href={galleriesHref({ q: f.q, uf: f.uf })} className={`hp-galleries-chip${f.tag ? '' : ' hp-galleries-chip--on'}`} aria-current={f.tag ? undefined : 'true'}>Todas</Link>
            {tags.map((t) => <Link key={t} href={galleriesHref({ q: f.q, uf: f.uf, tag: t })} className={`hp-galleries-chip${f.tag === t ? ' hp-galleries-chip--on' : ''}`} aria-current={f.tag === t ? 'true' : undefined}>{t}</Link>)}
          </div>
          <div className="hp-galleries-meta">
            <form method="get" action="/e/galleries" className="hp-galleries-uf">
              {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
              {f.tag ? <input type="hidden" name="tag" value={f.tag} /> : null}
              <label htmlFor="galleries-uf">Estado</label>
              <UfSelect ufs={ufs} value={f.uf ?? ''} />
              <noscript><button type="submit" className="hp-galleries-chip">Filtrar</button></noscript>
            </form>
            <span className="hp-galleries-total">{galleriesSummary(items.length, works)}</span>
          </div>
        </div>

        {items.length ? (
          <div className="hp-galleries-grid">
            {items.map((g) => (
              <Link key={g.slug} href={`/e/gallery/${g.slug}`} className="hp-galleries-card">
                <span className="hp-galleries-covers">
                  {[0, 1, 2].map((i) => (
                    <span key={i}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                      {g.covers[i] ? <img src={g.covers[i]} alt="" loading="lazy" /> : null}
                    </span>
                  ))}
                </span>
                <span className="hp-galleries-card__body">
                  <span className="hp-galleries-card__head">
                    <span className="hp-galleries-mark" aria-hidden="true">{galleryInitial(g.name)}</span>
                    <span className="hp-galleries-card__names">
                      <span className="hp-galleries-card__name">{g.name}<Icon name="verified" size={16} filled label="Galeria verificada" /></span>
                      <span className="hp-galleries-card__where">{[g.city, g.foundedYear ? `desde ${g.foundedYear}` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                  </span>
                  <span className="hp-galleries-card__desc">{g.summary ?? ''}</span>
                  {g.tags.length ? <span className="hp-galleries-tags">{g.tags.map((t) => <span key={t} className="hp-galleries-tag">{t}</span>)}</span> : null}
                  <span className="hp-galleries-counts">
                    <span className="hp-galleries-count"><span className="hp-galleries-count__n">{g.works}</span><span className="hp-galleries-count__l">obras à venda</span></span>
                    <span className="hp-galleries-count"><span className="hp-galleries-count__n">{g.artists}</span><span className="hp-galleries-count__l">artistas representados</span></span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : <div className="hp-galleries-empty">Nenhuma galeria encontrada com esses filtros.</div>}
      </section>

      <section className="hp-galleries-who">
        <div className="hp-galleries-who__box">
          <div className="hp-galleries-who__intro">
            <h2 className="hp-galleries-who__title">Toda obra mostra quem está vendendo</h2>
            <p className="hp-galleries-who__lead">No marketplace, cada anúncio identifica o vendedor antes da compra.</p>
          </div>
          <div className="hp-galleries-who__item"><Icon name="storefront" size={24} /><div className="hp-galleries-who__text"><b>Galeria</b><span>Parceira verificada, com nome, cidade e artistas que representa.</span></div></div>
          <div className="hp-galleries-who__item"><Icon name="person" size={24} /><div className="hp-galleries-who__text"><b>Particular</b><span>Colecionador com identidade verificada e escritura da obra em seu nome.</span></div></div>
        </div>
      </section>
    </>
  )
}
